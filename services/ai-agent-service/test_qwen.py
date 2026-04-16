import os
import dashscope
from config import settings

dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'
# The base URL for the Singapore region.
messages = [
    {'role': 'system', 'content': 'You are a helpful assistant.'},
    {'role': 'user', 'content': 'Who are you?'}
]
response = dashscope.Generation.call(
    # If you have not set the environment variable, replace the line below with: api_key="sk-xxx"
    # API keys for the Singapore, US (Virginia), and China (Beijing) regions are different. To obtain an API key, see https://www.alibabacloud.com/help/en/model-studio/get-api-key.
    api_key=settings.dashscope_api_key,
    model="qwen-plus", # This example uses qwen-plus. You can replace it with another model as needed. For a list of models, see https://www.alibabacloud.com/help/en/model-studio/getting-started/models.
    messages=messages,
    result_format='message'
    )
print(response)