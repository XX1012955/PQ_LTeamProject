// 将文本内容转换为标准题目格式
const fs = require('fs');
const path = require('path');

// 配置
const config = {
    outputDir: './questions',
    questionStartId: 100 // 题目ID起始值
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
}

// 从文本中提取关键概念
function extractConcepts(text) {
    const concepts = [];
    const lines = text.split('\n');
    
    let currentTopic = '';
    let currentSubtopic = '';
    let currentConcepts = [];
    
    // 调试信息
    console.log('开始提取概念...');
    console.log(`文本总行数: ${lines.length}`);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 跳过空行
        if (line.trim() === '') {
            continue;
        }
        
        // 检查是否是主题行（没有缩进和特殊符号，且不是以数字开头）
        if (!line.trim().startsWith('-') && !line.trim().startsWith('•') && !line.trim().match(/^\d+\./) && line.trim().length > 0) {
            // 如果这一行后面跟着一个空行或者是文件的最后一行，则认为它是一个主题
            if (i === lines.length - 1 || lines[i + 1].trim() === '') {
                if (currentTopic && currentConcepts.length > 0) {
                    // 保存之前的概念
                    concepts.push({
                        topic: currentTopic,
                        subtopic: currentSubtopic || currentTopic,
                        concepts: [...currentConcepts]
                    });
                    console.log(`保存主题: ${currentTopic}, 子主题: ${currentSubtopic || currentTopic}, 概念数: ${currentConcepts.length}`);
                    currentConcepts = [];
                }
                
                // 新的主题
                currentTopic = line.trim();
                currentSubtopic = '';
                console.log(`新主题: ${currentTopic}`);
                continue;
            }
        }
        
        // 检查是否是子主题行（以数字和点开头，或者包含冒号）
        if (line.trim().match(/^\d+\./) || (line.includes(':') && !line.trim().startsWith('-'))) {
            if (currentSubtopic && currentConcepts.length > 0) {
                // 保存之前的概念
                concepts.push({
                    topic: currentTopic,
                    subtopic: currentSubtopic,
                    concepts: [...currentConcepts]
                });
                console.log(`保存子主题: ${currentSubtopic}, 概念数: ${currentConcepts.length}`);
                currentConcepts = [];
            }
            
            // 新的子主题
            currentSubtopic = line.trim();
            console.log(`新子主题: ${currentSubtopic}`);
            continue;
        }
        
        // 提取概念（以破折号或点开头的行）
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            const concept = line.trim().substring(1).trim();
            if (concept) {
                currentConcepts.push(concept);
                console.log(`添加概念: ${concept}`);
            }
        }
    }
    
    // 保存最后一组概念
    if (currentTopic && currentConcepts.length > 0) {
        concepts.push({
            topic: currentTopic,
            subtopic: currentSubtopic || currentTopic,
            concepts: [...currentConcepts]
        });
        console.log(`保存最后的概念组: ${currentTopic}, ${currentSubtopic || currentTopic}, 概念数: ${currentConcepts.length}`);
    }
    
    return concepts;
}

// 生成选择题
function generateMultipleChoiceQuestions(concepts) {
    const questions = [];
    let questionId = config.questionStartId;
    
    for (const conceptGroup of concepts) {
        const { topic, subtopic, concepts: conceptList } = conceptGroup;
        
        if (conceptList.length < 4) {
            // 需要至少4个概念来生成选择题
            console.log(`跳过概念组 "${topic}" - "${subtopic}"，因为概念数量不足4个`);
            continue;
        }
        
        // 提取主题的简短描述
        const shortTopic = topic.length > 30 ? topic.substring(0, 30) + '...' : topic;
        
        // 为每个概念生成一个问题
        for (let i = 0; i < conceptList.length; i++) {
            const correctConcept = conceptList[i];
            
            // 从概念中提取关键词
            const colonIndex = correctConcept.indexOf('：');
            const keyTerm = colonIndex > 0 ? correctConcept.substring(0, colonIndex) : correctConcept.split(' ')[0];
            
            // 从其他概念中随机选择3个作为干扰项
            const otherConcepts = conceptList.filter((_, index) => index !== i);
            const shuffledOtherConcepts = otherConcepts.sort(() => 0.5 - Math.random());
            const distractors = shuffledOtherConcepts.slice(0, 3);
            
            // 生成问题
            let questionText = '';
            if (keyTerm && keyTerm.length < 20) {
                questionText = `以下关于${keyTerm}的描述，哪一项是正确的？`;
            } else {
                questionText = `在计算机基础知识中，以下哪一项描述是正确的？`;
            }
            
            // 生成选项
            const options = [
                { letter: 'A', content: correctConcept, is_answer: 1 },
                { letter: 'B', content: distractors[0], is_answer: 0 },
                { letter: 'C', content: distractors[1], is_answer: 0 },
                { letter: 'D', content: distractors[2], is_answer: 0 }
            ];
            
            // 随机打乱选项顺序
            const shuffledOptions = options.sort(() => 0.5 - Math.random());
            
            // 找出正确答案的字母
            const correctAnswer = shuffledOptions.find(option => option.is_answer === 1).letter;
            
            // 创建题目对象
            const question = {
                id: questionId++,
                content: questionText,
                options: shuffledOptions,
                answer: correctAnswer
            };
            
            questions.push(question);
            console.log(`生成题目 ${question.id}: ${question.content}`);
        }
    }
    
    return questions;
}

// 将题目转换为标准格式的文本
function formatQuestionsAsText(questions) {
    let output = '### 选择题\n\n';
    
    for (const question of questions) {
        output += `${question.id}. ${question.content}\n`;
        
        for (const option of question.options) {
            output += `${option.letter}. ${option.content}\n`;
        }
        
        output += `答案: ${question.answer}\n\n`;
    }
    
    return output;
}

// 处理单个文件
function processFile(filePath) {
    console.log(`处理文件: ${filePath}`);
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 提取概念
    const concepts = extractConcepts(content);
    console.log(`从文件中提取了 ${concepts.length} 组概念`);
    
    // 生成选择题
    const questions = generateMultipleChoiceQuestions(concepts);
    console.log(`生成了 ${questions.length} 道选择题`);
    
    if (questions.length === 0) {
        console.log('没有生成任何题目，请检查文本格式');
        return null;
    }
    
    // 格式化题目为文本
    const formattedQuestions = formatQuestionsAsText(questions);
    
    // 生成输出文件名
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(config.outputDir, `${fileName}_questions.txt`);
    
    // 写入文件
    fs.writeFileSync(outputPath, formattedQuestions, 'utf8');
    console.log(`题目已保存到: ${outputPath}`);
    
    return outputPath;
}

// 主函数
function main() {
    // 检查命令行参数
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('用法: node convert_text_to_questions.js <文件路径>');
        process.exit(1);
    }
    
    const filePath = args[0];
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        console.error(`错误: 文件 ${filePath} 不存在`);
        process.exit(1);
    }
    
    // 处理文件
    const outputPath = processFile(filePath);
    
    if (outputPath) {
        console.log('处理完成！');
        console.log(`生成的题目文件: ${outputPath}`);
        console.log('可以使用以下命令导入题目:');
        console.log(`node import-single-question.js ${outputPath}`);
    }
}

// 执行主函数
main();