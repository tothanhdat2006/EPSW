from langchain_community.chat_models.tongyi import ChatTongyi
import dashscope
dashscope.base_http_api_url = 'https://dashscope-intl.aliyuncs.com/api/v1'
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from config import settings
import logging

logger = logging.getLogger(settings.service_name)

CHAT_SYSTEM_PROMPT = """Bạn là Chuyên viên Hành chính Chuyên nghiệp hỗ trợ Cán bộ duyệt hồ sơ.
Nhiệm vụ của bạn là giải đáp các thắc mắc về nội dung hồ sơ dựa trên văn bản trích xuất được.

QUY TẮC:
1. Trả lời chính xác, trung thực dựa TRÊN NỘI DUNG VĂN BẢN (DOCUMENT CONTENT) bên dưới.
2. Nếu thông tin không có trong văn bản, hãy lịch sự thông báo rằng "Thông tin này không tìm thấy trong nội dung hồ sơ".
3. Nếu nội dung hồ sơ có nhãn "[MOCK OCR DATA]", hãy giải thích cho người dùng rằng đây là dữ liệu giả lập do hệ thống đang trong chế độ thử nghiệm (Development Mode).
4. Luôn trả lời bằng tiếng Việt chuyên nghiệp, lịch sự.

DOCUMENT CONTENT:
{raw_text}

EXTRACTED DATA:
{extracted_data}
"""

def _get_llm() -> ChatTongyi:
    return ChatTongyi(
        model=settings.llm_model,
        temperature=0.5,
        dashscope_api_key=settings.dashscope_api_key,
    )

async def conduct_ai_chat(message: str, history: list, document_context: dict):
    llm = _get_llm()
    
    # Prepare messages
    prompt = ChatPromptTemplate.from_messages([
        ("system", CHAT_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{input}")
    ])
    
    # Format context
    raw_text = document_context.get("rawText", "No raw text available.")
    extracted_data = {k: v for k, v in document_context.items() if k != "rawText"}
    
    chain = prompt | llm
    
    # Convert history to LangChain format
    formatted_history = []
    for h in history:
        if h["role"] == "user":
            formatted_history.append(HumanMessage(content=h["content"]))
        else:
            formatted_history.append(AIMessage(content=h["content"]))
            
    response = await chain.ainvoke({
        "raw_text": raw_text,
        "extracted_data": extracted_data,
        "history": formatted_history,
        "input": message
    })
    
    return response.content
