#!/usr/bin/env python3
"""
Oumi Training Script for Self-Healing DevOps SRE-LLM

This script fine-tunes a Llama-3 model on SRE logs using Oumi framework
for autonomous incident detection and analysis.
"""

import os
import sys
import yaml
import argparse
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Train SRE-LLM using Oumi')
    parser.add_argument(
        '--config',
        type=str,
        default='config.yaml',
        help='Path to Oumi configuration file'
    )
    parser.add_argument(
        '--train-data',
        type=str,
        default='./data/sre_train.jsonl',
        help='Path to training data'
    )
    parser.add_argument(
        '--eval-data',
        type=str,
        default='./data/sre_eval.jsonl',
        help='Path to evaluation data'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='./models/sre-llm',
        help='Output directory for trained model'
    )
    parser.add_argument(
        '--hf-token',
        type=str,
        help='HuggingFace token for accessing Llama models'
    )

    args = parser.parse_args()

    # Validate inputs
    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Configuration file not found: {config_path}")
        sys.exit(1)

    # Load configuration
    logger.info(f"Loading configuration from {config_path}")
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    # Override paths with command line arguments
    config['data']['train_path'] = args.train_data
    config['data']['eval_path'] = args.eval_data
    config['output']['output_dir'] = args.output_dir

    if args.hf_token:
        os.environ['HF_TOKEN'] = args.hf_token
        os.environ['HUGGING_FACE_TOKEN'] = args.hf_token

    # Import Oumi after environment setup
    try:
        from oumi import train
        from oumi.core.configs import TrainingConfig, ModelConfig, DataConfig
        from oumi.core.distributed import setup_distributed
        from oumi.utils.logging import configure_logging
    except ImportError as e:
        logger.error(f"Failed to import Oumi: {e}")
        logger.error("Please install Oumi: pip install oumi[torch]")
        sys.exit(1)

    try:
        # Set up distributed training if needed
        setup_distributed()
        configure_logging()

        # Create config objects
        model_config = ModelConfig(**config['model'])
        data_config = DataConfig(**config['data'])

        training_config = TrainingConfig(
            model=model_config,
            data=data_config,
            **config['training'],
            **config['output'],
            **config.get('evaluation', {})
        )

        logger.info("Starting SRE-LLM training...")
        logger.info(f"Model: {config['model']['base']}")
        logger.info(f"Training data: {args.train_data}")
        logger.info(f"Eval data: {args.eval_data}")
        logger.info(f"Output directory: {args.output_dir}")

        # Start training
        train(training_config)

        logger.info("Training completed successfully!")
        logger.info(f"Model saved to: {args.output_dir}")

        # Run inference test
        test_inference(args.output_dir)

    except Exception as e:
        logger.error(f"Training failed: {e}")
        sys.exit(1)

def test_inference(model_path: str):
    """Test the trained model with a sample inference"""
    try:
        from oumi import infer
        from oumi.core.configs import InferenceConfig, ModelConfig

        logger.info("Testing inference with trained model...")

        # Load model configuration
        model_config = ModelConfig(
            model_name_or_path=model_path,
            adapter_model_name_or_path=os.path.join(model_path, "adapter"),
            trust_remote_code=True
        )

        inference_config = InferenceConfig(
            model=model_config,
            max_new_tokens=256,
            temperature=0.1,
            do_sample=False
        )

        # Test prompts
        test_logs = [
            "FATAL: Connection pool exhausted - max_connections=100 exceeded",
            "ERROR: Memory usage exceeded 95% threshold on node-3",
            "WARNING: Disk usage at 85% on /var/log partition"
        ]

        for log in test_logs:
            json_template = '''Respond with this exact JSON structure:
{
  "severity": "critical|high|medium|low",
  "category": "database|network|memory|disk|auth|application",
  "summary": "One line description",
  "suggested_fix": "Specific fix action",
  "affected_file": "path/to/file if applicable or null",
  "confidence": 0.85
}'''

            prompt = (
                "Analyze this infrastructure log and classify its severity, category, "
                "provide a summary, suggest a fix, and identify the affected file if applicable. "
                "Respond with valid JSON only.\n\n"
                f"LOG: {log}\n\n"
                f"{json_template}"
            )

            result = infer(prompt, inference_config)
            logger.info("Input: %s", log)
            logger.info("Analysis: %s", result)
            logger.info("---")

    except Exception as e:
        logger.warning(f"Inference test failed: {e}")

if __name__ == "__main__":
    main()
