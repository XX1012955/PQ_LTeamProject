<template>
    <div class="login-bg">
    <div class="login-container">
        <el-container>
            <!-- 侧边图-->
            <el-aside width="300px" class="login-side">
                <img id="shape" src="imgs/login/shape.png" alt="Logo">
            </el-aside>
            <!-- 主空间 -->
            <el-main id="elMain" class="login-card">
                <!-- logo -->
                <div id="logo" class="login-logo">
                    <router-link :to="{name:'MainPage'}"><el-image src="imgs/login/logo.png" id="logoImg" :fit="'scale-down'" alt="Logo"></el-image></router-link>
                </div>
                <!-- info -->
                <div id="info" class="login-info">
                    <!-- 介绍 -->
                    <div class="information">欢迎登录</div>
                    <!-- <div class="information">名师免费教学</div>
                    <div class="information">享优质教育资源</div> -->
                    <div style="visibility: hidden">占行</div>
                    <!-- 详细-->
                    <div class="details">如果您还没有账户，您可以 </div>
                    <!-- 超链接-->
                    <router-link class="register" :to="{name:'Register'}">点我注册</router-link>
                    <!-- 新增管理员按钮 -->
                    <div style="visibility: hidden">占行</div>
                    <el-button @click="goToAdminLogin" class="admin-btn" style="margin-top: 10px;">管理员登录</el-button>
                    
                </div>
                <!-- center -->
                <div id="center">
                    <transition name="el-fade-in-linear">
                        <img style="transition:3s" v-show="!show" src="imgs/login/center.png" alt="图片下班了~">
                    </transition>
                </div>
                <!-- form标题 -->
                <div id="form-title"> {{pageTitle[type]}}</div>
                <!-- form表单 -->
                <div id="form">
                    <el-form ref="form" :model="form" label-width="80px" class="login-form">
                        <el-form-item> <!-- 账号 长度限制24 自带清除 -->
                            <el-input class="input" v-model="form.id" placeholder="用户ID" maxlength="24" clearable></el-input>
                        </el-form-item>
                        <el-form-item> <!-- 密码 自带显示密码 -->
                            <el-input class="input" v-model="form.psw" placeholder="密码" maxlength="24" clearable show-password></el-input>
                        </el-form-item>
                        <el-form-item class="verify-row"> <!-- 验证码 -->
                            <el-input id="verifyCodeBox" class="input" v-model="form.verifyCode" maxlength="4" placeholder="验证码"></el-input>
                        </el-form-item>
                        <el-form-item> <!-- 忘记密码 -->
                            <router-link id="forgotPsw-sy" :to="{name:'ForgetPsw'}" >忘记密码？</router-link>
                        </el-form-item>
                        <el-form-item>  <!-- 登陆确认按钮 -->
                            <el-button type="primary" @click="onSubmit" id="confirm" class="login-btn"><span id="btLogin">登录</span></el-button>
                        </el-form-item>
                        


                        <el-form-item>  <!-- 版权信息 -->
                            <span id="form-info">   </span>
                        </el-form-item>
                    </el-form>
                </div>
                <!-- 验证码图片单独定位 -->
                <div id="verifyCode" v-show="verifyCodeShow">
                    <img src="/checkCodeServlet" id="verifyCodeImg" @click="changeVerifyImg" class="verify-img" alt="图片下班了~">  <!-- 验证码图片 -->
                </div>

            </el-main>
        </el-container>

    </div>
    </div>

</template>

<script>
    import SHAEncrypt from "@/components/SHAEncrypt";
    export default {
        name: "Login",
        components: {
            SHAEncrypt,
        },
        data() {
            return {
                // 用户类别-对应pageTitle数组下标
                type: '1',
                pageTitle: ["管理员", "欢迎登录"],
                // 动画控制器
                show: true,
                // 表单数据模型
                form: {
                    id: '',
                    psw: '',
                    verifyCode: '',
                    type: '',
                },
                verifyCodeShow: false,
            }
        },
        beforeMount() {
            // 获取用户类型
            this.getType();
        },
        mounted() {
            // 刷新验证码
            this.changeVerifyImg();
            this.verifyCodeShow = true;
            this.show = false;
        },
        // 方法模型
        methods: {
            // 从路由参数中获取类型
            getType() {
                this.type = this.$route.query.type;
                // 越界检测
                if (this.type!== '1' && this.type!== '123') this.type = '1';
                if (this.type === '123') this.type = '0';
            },
            // 切换验证码图片
            changeVerifyImg() {
                document.getElementById("verifyCodeImg").src = "/checkCodeServlet?" + new Date().getMilliseconds();
            },
            // 提交表单
            onSubmit() {
                // 补充用户信息
                this.form.type = this.type;
                let form = /^\w{4,24}$/;
                // 验证账号格式
                if (form.test(this.form.id) === false) {
                    this.$message.error('账号格式有误哦~');
                    return;
                }
                // 验证密码格式
                if (form.test(this.form.psw) === false) {
                    this.$message.error('密码格式有误哦~');
                    return;
                }
                // 验证码格式
                let formCode = /^\w{4}$/;
                if (formCode.test(this.form.verifyCode) === false) {
                    this.$message.error('验证码格式有误哦~');
                    return;
                }
                // password加密
                this.form.psw = SHAEncrypt.methods.sha1(this.form.psw);
                // 发送表单给后端
                this.$axios.post("/LoginCon/login", this.form).then((res) => {
                    if (res.data.flag) {
                        // 登陆成功
                        this.$message.success("登陆成功！");
                        if (this.type === '1') // 用户登录
                        {
                            this.$router.push({
                                name: 'UserMainPage',
                            })
                        } else if (this.type === '0')// 管理员登录
                        {
                            this.$router.push({
                                name: 'AdminMainPage',
                            })
                        }
                    } else {
                        this.form.psw = '';
                        // 登录失败
                        this.$message.warning(res.data.msg);
                    }
                    // 切换验证码
                    this.changeVerifyImg();
                });
            },
            // 跳转到管理员登录页面（在新标签页打开）
            goToAdminLogin() {
                window.open("http://localhost/#/Login?type=123", '_blank');
            }
        }
    }
</script>

<style scoped>
    /* 背景 */
    .login-bg {
    min-height: 100vh;
     background: linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%);
     justify-content: center;
    }

    主容器
    .login-container {
    display: flex;
    background: none;
    box-shadow: none;
    border-radius: 16px;
    overflow: hidden;
    width: 900px;
    max-width: 95vw;
    }

    /* 右侧卡片 */
    .login-card {
    background: #ffffff;
    padding: 48px 40px 32px 40px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: 0 16px 16px 0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
    }

    /* logo */
    .login-logo {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
    }

    /* 欢迎信息 */
    .login-info {
    text-align: center;
    margin-bottom: 24px;
    }

    .admin-btn {
    font-size: 14px;
    color: #888;
    margin-top: 4px;
    }

    .login-form {
    margin-top: 8px;
    }
    .login-form .el-form-item {
    margin-bottom: 18px;
    }

    .login-btn {
    width: 100%;
    height: 44px;
    font-size: 18px;
    border-radius: 8px;
    background: #00ce23;
    border: none;
    }
    .login-btn:hover {
    background: #02b521;
    }

    .verify-row {
    align-items: center;
    }
    /* 侧边图 */
    #shape {
        height: 97.7vh;
    }

    /*
     * main 元素定位
     */
    #elMain {
        position: relative;
    }

    /* Logo */
    #logo {
        top: 8%; /* 原来是15%，改成更小的值，logo会更靠上 */
        left: 1%;
        position: absolute;
    }

    ::v-deep #logoImg {
        width: 240px;
        height: 79px;
        margin-top: -20px; /* 新增，向上移动20px，可根据实际效果调整数值 */
    }
    
    .verify-img {
    width: 110px;
    height: 40px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid #eee;
    margin-top: -65px; /* 新增，向上移动10px，可根据实际效果调整数值 */
    }   


    /* info */
    #info {
        /* 位置 */
        top: 35%;
        left: 1%;
        position: absolute;
        /* 窗口大小 */
        width: 18%;
        height: 30%;
    }

    /* 介绍 */
    .information {
        font-family: "微软雅黑";
        font-size: 35px;
        margin-bottom: 8px;
        /* 文字间距 */
        letter-spacing: 3px;
    }

    /* 详细 */
    .details {
        font-family: "微软雅黑";
        font-size: 20px;
        color: #3c3f45;
        margin-bottom: 7px;
        /* 文字间距 */
        letter-spacing: 1px;
    }

    /* 注册超链接*/
    .register {
        text-decoration: none;
        font-size: 18px;
        font-weight: 500;
        color: #02b521;
        /* 文字间距 */
        letter-spacing: 1px;
    }

    /* 注册超链接悬浮 */
    .register:hover {
        text-decoration: underline;
        color: #4a95f1;
    }

    /* center */
    #center {
        top: 20%;
        left: 20%;
        position: absolute;
    }

    /*
     * form 表单
     */
    /* 输入框 */
    ::v-deep .el-input__inner {
        font-size: 16px;
        height: 60px;
        border-radius: 8px;
        background-color: #EBF0F6;
    }

    #form-title {
        /* 位置偏移 */
        top: 20%;
        left: 67%;
        position: absolute;
        color: #808892;
        font-size: 20px;
        font-family: "微软雅黑";
        /* 文字间距 */
        letter-spacing: 1px;
    }

    #form {
        /* 位置 */
        top: 27%;
        left: 52%;
        position: absolute;
        /* 窗口大小 */
        width: 30%;
        height: 50%;
    }

    /* 验证码输入 */
    ::v-deep #verifyCodeBox {
        width: 45%;
    }

    /* 忘记密码超链接 */
    #forgotPsw-sy {
    left: 10px;
    position: relative;
    text-decoration: none;
    font-size: 16px;
    font-weight: 500;
    color: #b5b7b4;
    /* 文字间距 */
    letter-spacing: 1px;
    margin-top: 10px;      /* 新增或调整，减小上边距 */
    margin-bottom: 2px;   /* 新增或调整，减小下边距 */
    padding-top: 0;       /* 如有需要，也可设置为0 */
    padding-bottom: 0;    /* 如有需要，也可设置为0 */
    }

    /* 忘记密码悬浮 */
    #forgotPsw-sy:hover {
        text-decoration: underline;
        color: #888a88;
    }

    /* 登录按钮 */
    #confirm {
        height: 55px;
        width: 100%;
        /* 圆角半径 */
        border-radius: 10px;
        background-color: #00ce23;
    }

    /* 登录按钮活动 */
    #confirm:hover {
        background-color: #00ce23;
    }

    /* 登录文字 */
    #btLogin {
        color: #ffffff;
        font-size: 20px;
        font-weight: 500;
        font-family: "微软雅黑";
        /* 文字间距 */
        letter-spacing: 10px;
    }

    /* 验证码单独设置 */
    #verifyCode {
        /* 位置 */
        top: 44.2%;
        left: 69.5%;
        position: absolute;
    }

    /* 验证码 */
    #verifyCodeImg {
        /* 大小 */
        width: 190px;
        height: 75px;
    }

    /* 版权信息*/
    #form-info {
        /* 位置偏移 */
        left: 30px;
        position: relative;
        color: #808892;
        font-size: 14px;
        font-family: "微软雅黑";
        /* 文字间距 */
        letter-spacing: 1px;
    }

</style>