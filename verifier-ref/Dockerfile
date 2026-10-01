FROM python:3.13-slim
WORKDIR /verifier
COPY verify.py .
USER 65534:65534
ENTRYPOINT ["python3", "verify.py"]
