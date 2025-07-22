import textract
import os
import chardet


def extract_text_from_file(file_path):
    """
    从指定文件中提取文本内容，自动检测编码格式。
    支持的文件格式包括 DOC、DOCX、TXT 等。
    :param file_path: 文件路径
    :return: 提取的文本内容
    """
    try:
        # 使用 textract 提取文本（返回 bytes 类型）
        raw_data = textract.process(file_path)

        # 检测文件编码
        encoding_detect = chardet.detect(raw_data)
        encoding = encoding_detect['encoding'] or 'utf-8'

        # 尝试解码（忽略无法解码的字符）
        text = raw_data.decode(encoding, errors='ignore')
        return text
    except Exception as e:
        print(f"提取文件 {file_path} 时发生错误：{e}")
        return ""


def process(file_path):
    """
    处理单个文件：提取文本并保存到指定位置
    :param file_path: 要处理的文件路径
    """
    # 确保输出目录存在
    os.makedirs('txt_QuizSource', exist_ok=True)

    # 检查文件是否存在
    if not os.path.exists(file_path):
        print(f"错误：文件 {file_path} 不存在")
        return

    # 提取文件文本
    print(f"正在处理文件：{os.path.basename(file_path)}")
    text = extract_text_from_file(file_path)

    if not text.strip():
        print("警告：提取到的文本内容为空")
        return

    # 写入输出文件（覆盖模式）
    output_path = 'txt_QuizSource/txt_text.txt'
    with open(output_path, 'a', encoding='utf-8') as txt_file:
        txt_file.write(text)

    print(f"文件内容已保存到 {output_path}")
    generated = []
    generated.append('txt_QuizSource/txt_text.txt')
    return generated