/*
* 该文件是整个项目的入口文件
*/
// 引入Vue
import Vue from 'vue'

// 引入App
import App from './App.vue'

// 引入VueRouter
import VueRouter from 'vue-router'

// 引入路由器
import router from './router'

// 引入axios依赖并全局注册
import axios from 'axios'
// 配置axios默认值
axios.defaults.withCredentials = true // 允许跨域请求携带凭证
// 使用相对路径，避免跨域问题
axios.defaults.baseURL = '' // 使用相对路径
// 添加请求拦截器处理登录状态
axios.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // 如果响应状态为401或被重定向到登录页，则跳转到登录页
    if (error.response && (error.response.status === 401 || 
        (error.response.data && error.response.data.indexOf('/#/Login') > -1))) {
      router.push('/Login');
    }
    return Promise.reject(error);
  }
);
Vue.prototype.$axios = axios

// 引入echarts依赖并全局注册
import * as echarts from 'echarts'
// 需要挂载到Vue原型上
Vue.prototype.$echarts = echarts

// 引入element-ui
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
Vue.use(ElementUI);

//关闭Vue的生产提示
Vue.config.productionTip = false
//应用插件
Vue.use(VueRouter)

// 引入阿里在线图标
import "./assets/ali-icon.css"


// 创建Vue实例对象---vm
new Vue({
    el:"#app",
    // 将App组件放入容器中
    render: h => h(App),
    router:router,
})