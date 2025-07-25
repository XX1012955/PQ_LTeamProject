// 测试考试生成流程
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testExamGeneration() {
    try {
        console.log('开始测试考试生成流程...');
        
        // 创建测试文件
        const testContent = `
计算机网络基础知识

计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过通信线路连接起来，在网络操作系统，网络管理软件及网络通信协议的管理和协调下，实现资源共享和信息传递的计算机系统。

OSI七层模型从下到上分别是：物理层、数据链路层、网络层、传输层、会话层、表示层、应用层。

TCP/IP协议是Internet最基本的协议，是Internet国际互联网络的基础。TCP/IP协议采用四层结构，分别是网络接口层、网络层、传输层和应用层。

路由器工作在网络层，交换机工作在数据链路层。

HTTP协议是应用层协议，默认端口是80。HTTPS是HTTP的安全版本，默认端口是443。

IP地址分为IPv4和IPv6两个版本。IPv4地址长度为32位，通常表示为四段十进制数，如192.168.1.1。IPv6地址长度为128位，通常表示为八组四位十六进制数。
        `;
        
        const testFilePath = path.join(__dirname, 'test_network.txt');
        fs.writeFileSync(testFilePath, testContent, 'utf8');
        console.log('创建测试文件:', testFilePath);
        
        // 步骤1: 上传文件
        console.log('步骤1: 上传测试文件...');
        const formData = new FormData();
        formData.append('files', fs.createReadStream(testFilePath));
        
        const uploadResponse = await axios.post('http://localhost:3001/api/upload-files', formData, {
            headers: formData.getHeaders()
        });
        
        if (uploadResponse.data.success) {
            console.log('文件上传成功:', uploadResponse.data.message);
        } else {
            throw new Error('文件上传失败: ' + uploadResponse.data.error);
        }
        
        // 步骤2: 生成考试
        console.log('步骤2: 生成考试...');
        const examResponse = await axios.post('http://localhost:3001/api/generate-exam-flow', {
            title: '计算机网络基础测试'
        }, {
            timeout: 180000 // 3分钟超时
        });
        
        if (examResponse.data.success) {
            console.log('考试生成成功!');
            console.log('考试ID:', examResponse.data.examId);
            console.log('题目数量:', examResponse.data.questionCount);
            console.log('考试预览URL: http://localhost:8080/#/Management/ExamPreview/' + examResponse.data.examId);
        } else {
            throw new Error('考试生成失败: ' + examResponse.data.error);
        }
        
        // 清理测试文件
        fs.unlinkSync(testFilePath);
        console.log('清理测试文件完成');
        
        console.log('测试完成！');
        
    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

// 等待服务器启动后再测试
setTimeout(() => {
    testExamGeneration();
}, 5000); // 等待5秒