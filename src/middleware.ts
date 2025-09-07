import { sequence } from "astro/middleware"
import { useAstroI18n } from "astro-i18n"

const astroI18n = useAstroI18n({
  primaryLocale: "en",
  secondaryLocales: ["zh"],
  fallbackLocale: "en",
  showPrimaryLocale: false,
  trailingSlash: "never",
  run: "client+server",
  translations: {
    common: {
      en: {
        "profile.title": "User Profile",
        "profile.userInfo": "User Information",
        "profile.name": "Name",
        "profile.email": "Email",
        "profile.notSet": "Not set",
        "profile.changePassword": "Change Password",
        "profile.currentPassword": "Current Password",
        "profile.newPassword": "New Password",
        "profile.confirmPassword": "Confirm New Password",
        "profile.updatePassword": "Update Password",
        "profile.backToMenu": "Back to Menu",
        "profile.failedToLoad": "Failed to load user data",
        "login.title": "Login - Game App",
        "login.heading": "Login",
        "login.email": "Email",
        "login.emailPlaceholder": "Enter your email",
        "login.password": "Password",
        "login.passwordPlaceholder": "Enter your password",
        "login.name": "Name (optional)",
        "login.namePlaceholder": "Enter your name",
        "login.loginButton": "Login",
        "login.signupButton": "Sign Up",
        "login.description": "Enter your credentials to login or sign up with a new account",
        "login.loginFailed": "Login failed. Please check your credentials.",
        "login.signupFailed": "Signup failed. Email might already be in use.",
        "login.emailRequired": "Email and password are required for signup.",
        "login.nameRequired": "Name is required for signup.",
        "menu.title": "Main Menu - Game App",
        "menu.heading": "Main Menu",
        "menu.startGame": "Start Game",
        "menu.settings": "Settings"
      },
      zh: {
        "profile.title": "用户资料",
        "profile.userInfo": "用户信息",
        "profile.name": "姓名",
        "profile.email": "邮箱",
        "profile.notSet": "未设置",
        "profile.changePassword": "修改密码",
        "profile.currentPassword": "当前密码",
        "profile.newPassword": "新密码",
        "profile.confirmPassword": "确认新密码",
        "profile.updatePassword": "更新密码",
        "profile.backToMenu": "返回菜单",
        "profile.failedToLoad": "加载用户数据失败",
        "login.title": "登录 - 游戏应用",
        "login.heading": "登录",
        "login.email": "邮箱",
        "login.emailPlaceholder": "输入您的邮箱",
        "login.password": "密码",
        "login.passwordPlaceholder": "输入您的密码",
        "login.name": "姓名（可选）",
        "login.namePlaceholder": "输入您的姓名",
        "login.loginButton": "登录",
        "login.signupButton": "注册",
        "login.description": "输入您的凭据进行登录或使用新账户注册",
        "login.loginFailed": "登录失败。请检查您的凭据。",
        "login.signupFailed": "注册失败。邮箱可能已被使用。",
        "login.emailRequired": "注册需要邮箱和密码。",
        "login.nameRequired": "注册需要姓名。",
        "menu.title": "主菜单 - 游戏应用",
        "menu.heading": "主菜单",
        "menu.startGame": "开始游戏",
        "menu.settings": "设置"
      }
    }
  }
})

export const onRequest = sequence(astroI18n)