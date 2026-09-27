FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 65532 --shell /usr/sbin/nologin axi

COPY . ./
RUN mkdir -p /var/lib/axi/files \
    && chown -R 65532:65532 /app /var/lib/axi/files

USER 65532:65532
EXPOSE 8085
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8085"]
