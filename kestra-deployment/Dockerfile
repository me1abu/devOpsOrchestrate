FROM kestra/kestra:latest

# Expose port
EXPOSE 8080

# Copy flows if you want to include them
COPY ./kestra/flows /app/flows/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
  CMD curl -f http://localhost:8080/health || exit 1

# Default command (Railway will set the command via environment or use this)
CMD ["/app/kestra", "server", "standalone", "--worker-thread=128"]
