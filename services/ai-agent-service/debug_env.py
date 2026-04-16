import asyncio
from config import settings
import os

def check_env():
    print(f"Service: {settings.service_name}")
    print(f"LLM Model: {settings.llm_model}")
    print(f"API Key Present: {'Yes' if settings.dashscope_api_key else 'No'}")
    print(f"API Key Length: {len(settings.dashscope_api_key) if settings.dashscope_api_key else 0}")
    print(f"Kafka Brokers: {settings.kafka_brokers}")
    print(f"Database URL: {settings.database_url}")
    
    # Check .env existence
    paths = ["../../.env", ".env"]
    for p in paths:
        print(f"Looking for env file at {os.path.abspath(p)}: {'Found' if os.path.exists(p) else 'Not Found'}")

if __name__ == "__main__":
    check_env()
