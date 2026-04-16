import asyncio
from agents.chat_agent import conduct_ai_chat
from config import settings

async def test_chat():
    print("Testing AI Chat Agent...")
    print(f"Model: {settings.llm_model}")
    
    context = {
        "rawText": "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM. Tên tôi là Nguyễn Văn A. Tôi sinh ngày 15/05/1990.",
        "subjectName": "Nguyễn Văn A"
    }
    
    message = "Tên của người trong hồ sơ là gì?"
    history = []
    
    try:
        response = await conduct_ai_chat(message, history, context)
        print(f"AI Response: {response}")
    except Exception as e:
        print(f"Chat Failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_chat())
