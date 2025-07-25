#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os
import logging
import importlib
from openai import OpenAI

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='extract_questions.log',
    filemode='a'
)

# 文件类型与处理模块的映射
PROCESSOR_MAPPING = {
    # 视频文件
    '.mp4': 'videoPPTDetect',
    '.avi': 'videoPPTDetect',
    '.mov': 'videoPPTDetect',
    '.mkv': 'videoPPTDetect',

    # PDF文件
    '.pdf': 'pdfToTxt',

    # 图像文件
    '.jpg': 'PPTPictureToTxt',
    '.jpeg': 'PPTPictureToTxt',
    '.png': 'PPTPictureToTxt',

    # 文本文件
    '.txt': 'txtToTxt',
    '.doc': 'txtToTxt',
    '.docx': 'txtToTxt',
    '.ppt': 'txtToTxt',
    '.pptx': 'txtToTxt',
    '.xls': 'txtToTxt',
    '.xlsx': 'txtToTxt',

    # 音频文件
    '.wav': 'voiceFileToTxt',
}

# OpenAI客户端配置
try:
    OPENAI_CLIENT = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key="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",
    )
except Exception as e:
    logging.error(f"初始化OpenAI客户端失败: {str(e)}")
    OPENAI_CLIENT = None

def get_file_processor(file_path):
    """获取文件对应的处理模块"""
    ext = os.path.splitext(file_path)[1].lower()
    module_name = PROCESSOR_MAPPING.get(ext)
    if not module_name:
        return None

    try:
        return importlib.import_module(module_name)
    except ImportError:
        logging.error(f"处理模块 {module_name} 未找到 (文件: {file_path})")
    except Exception as e:
        logging.error(f"导入模块 {module_name} 时出错: {str(e)}")
    return None

def generate_quiz_from_text(text_content, title):
    """从文本内容生成选择题"""
    if not text_content.strip():
        logging.warning("文本内容为空")
        return ""

    # 如果OpenAI客户端初始化失败，返回空字符串
    if not OPENAI_CLIENT:
        logging.error("OpenAI客户端未初始化，无法生成选择题")
        return ""

    # 生成提示词
    prompt = (
        "你是一位大学老师，需要根据以下的内容为大学四年级学生设计5道高质量的选择题。\n"
        "要求：\n"
        "1. 题目难度适中，符合大四学生认知水平\n"
        "2. 每道题有4个选项，只有1个正确答案\n"
        "3. 题目应覆盖文本中的关键知识点\n"
        "4. 题目格式：'问题\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n答案: [选项字母]'\n\n"
        f"文本内容:\n{text_content}"
    )

    logging.info("开始生成选择题...")

    try:
        # 调用OpenAI API生成题目
        completion = OPENAI_CLIENT.chat.completions.create(
            model="deepseek/deepseek-r1-0528:free",
            messages=[
                {"role": "system", "content": "你是一位经验丰富的大学老师，擅长根据文本内容设计高质量的选择题"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.7
        )

        quiz_content = completion.choices[0].message.content
        logging.info("选择题生成成功")
        return quiz_content

    except Exception as e:
        logging.error(f"生成选择题失败: {str(e)}")
        return ""

def create_example_questions(source_type, output_file):
    """创建示例题目"""
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(f"### 选择题\n")
            f.write(f"1. 这是一个从{source_type}文件自动生成的示例题目\n")
            f.write(f"A. 选项A\n")
            f.write(f"B. 选项B\n")
            f.write(f"C. 选项C\n")
            f.write(f"D. 选项D\n")
            f.write(f"答案: B\n\n")
            
            f.write(f"### 选择题\n")
            f.write(f"2. 这是第二个从{source_type}文件自动生成的示例题目\n")
            f.write(f"A. 选项A\n")
            f.write(f"B. 选项B\n")
            f.write(f"C. 选项C\n")
            f.write(f"D. 选项D\n")
            f.write(f"答案: C\n")
        
        logging.info(f"已创建示例题目: {output_file}")
        return True
    except Exception as e:
        logging.error(f"创建示例题目失败: {str(e)}")
        return False

def main():
    """
    从上传的文件中提取题目
    用法: python extract_questions.py <input_file> <output_file> <source_type> <title>
    """
    if len(sys.argv) < 5:
        print("Usage: python extract_questions.py <input_file> <output_file> <source_type> <title>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    source_type = sys.argv[3]
    title = sys.argv[4]
    
    try:
        logging.info(f"处理文件: {input_file}, 类型: {source_type}, 标题: {title}")
        
        # 确保输入文件存在
        if not os.path.exists(input_file):
            logging.error(f"输入文件不存在: {input_file}")
            print(f"Input file not found: {input_file}", file=sys.stderr)
            sys.exit(1)
        
        # 确保输出目录存在
        output_dir = os.path.dirname(output_file)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            logging.info(f"创建输出目录: {output_dir}")
        
        # 根据文件类型处理
        if source_type == 'text':
            # 对于文本文件，直接读取内容
            try:
                with open(input_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 检查内容是否已经是选择题格式
                if "答案:" in content and any(line.strip().startswith(f"{i+1}.") for i in range(5)):
                    # 已经是选择题格式，直接使用
                    with open(output_file, 'w', encoding='utf-8') as f:
                        f.write(content)
                    logging.info(f"文件已经是选择题格式，直接复制: {input_file} -> {output_file}")
                    print(f"Successfully copied file to {output_file}")
                    sys.exit(0)
                else:
                    # 尝试生成选择题
                    quiz_content = generate_quiz_from_text(content, title)
                    if quiz_content:
                        with open(output_file, 'w', encoding='utf-8') as f:
                            f.write(quiz_content)
                        logging.info(f"已生成选择题并保存到: {output_file}")
                        print(f"Successfully generated quiz and saved to {output_file}")
                        sys.exit(0)
                    else:
                        # 生成失败，创建示例题目
                        if create_example_questions(source_type, output_file):
                            print(f"Created example questions in {output_file}")
                            sys.exit(0)
                        else:
                            print(f"Failed to create example questions", file=sys.stderr)
                            sys.exit(1)
            except Exception as e:
                logging.error(f"处理文本文件失败: {str(e)}")
                print(f"Failed to process text file: {str(e)}", file=sys.stderr)
                
                # 尝试创建示例题目
                if create_example_questions(source_type, output_file):
                    print(f"Created example questions in {output_file}")
                    sys.exit(0)
                else:
                    sys.exit(1)
        else:
            # 对于其他类型，创建示例题目
            if create_example_questions(source_type, output_file):
                print(f"Created example questions in {output_file}")
                sys.exit(0)
            else:
                sys.exit(1)
    
    except Exception as e:
        logging.error(f"处理文件时出错: {str(e)}")
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()