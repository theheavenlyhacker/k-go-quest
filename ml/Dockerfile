FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY kgo_bkt ./kgo_bkt
COPY service ./service
COPY scripts ./scripts
COPY tests ./tests

# Fails closed without KGO_ML_TOKEN; see service/settings.py.
RUN useradd --create-home app && chown -R app /app
USER app

EXPOSE 8000
# Most hosts inject $PORT; fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn service.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
