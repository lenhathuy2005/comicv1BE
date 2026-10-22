const express = require('express');
const authController = require('../controllers/auth.controller');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshValidator,
} = require('../validators/auth.validator');
const validate = require('../../../middlewares/validate.middleware');
const { requireAuth } = require('../../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Xác thực và quản lý phiên đăng nhập
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - displayName
 *       properties:
 *         username:
 *           type: string
 *           example: dao_huu_001
 *         email:
 *           type: string
 *           format: email
 *           example: viet02@gmail.com
 *         password:
 *           type: string
 *           format: password
 *           example: 12345678
 *         displayName:
 *           type: string
 *           example: Đạo Hữu 05
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *       properties:
 *         identifier:
 *           type: string
 *           description: Username hoặc email
 *           example: viet01@gmail.com
 *         password:
 *           type: string
 *           format: password
 *           example: 123456789
 *
 *     VerifyEmailRequest:
 *       type: object
 *       required:
 *         - token
 *       properties:
 *         token:
 *           type: string
 *           example: verify_new_token_123456
 *
 *     ForgotPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: viet01@gmail.com
 *
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - newPassword
 *       properties:
 *         token:
 *           type: string
 *           example: reset_zj7SvV68LT1CTcO_CaQc4oLA5EDtAJH9DajI2mmHAPEyYydS
 *         newPassword:
 *           type: string
 *           format: password
 *           example: 123456789
 *
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy
 *
 *     LogoutRequest:
 *       type: object
 *       required:
 *         - tokenValue
 *       properties:
 *         tokenValue:
 *           type: string
 *           example: sess_nXrHL3LlHp9AeKhOPlmc09scnDGFXP5PtB-oYxkuIBv718Cc
 *
 *     AuthUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         username:
 *           type: string
 *           example: viet01
 *         email:
 *           type: string
 *           format: email
 *           example: viet01@gmail.com
 *         displayName:
 *           type: string
 *           example: Việt
 *         roleCode:
 *           type: string
 *           example: admin
 *
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access.token
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.token
 *         sessionToken:
 *           type: string
 *           example: sess_xxxxxxxxxxxxxxxxx
 *         user:
 *           $ref: '#/components/schemas/AuthUser'
 *
 *     StandardSuccess:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Thành công
 *         data:
 *           type: object
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Dữ liệu không hợp lệ
 */

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Đăng ký tài khoản
 *     description: Tạo tài khoản mới theo mẫu request từ Postman collection.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       409:
 *         description: Username hoặc email đã tồn tại
 */
router.post('/register', registerValidator, validate, authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Đăng nhập
 *     description: Đăng nhập bằng identifier và password theo đúng Postman collection.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       401:
 *         description: Sai tài khoản hoặc mật khẩu
 *       403:
 *         description: Tài khoản bị khóa
 */
router.post('/login', loginValidator, validate, authController.login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Lấy thông tin tài khoản hiện tại
 *     description: Cần Bearer token hợp lệ.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.get('/me', requireAuth, authController.me);

/**
 * @openapi
 * /api/auth/verify-email:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Xác thực email
 *     description: Xác thực email bằng token theo đúng mẫu Postman.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *     responses:
 *       200:
 *         description: Xác thực email thành công
 *       400:
 *         description: Token không hợp lệ hoặc đã hết hạn
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Yêu cầu quên mật khẩu
 *     description: Gửi email để tạo reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Nếu email tồn tại, hệ thống đã xử lý yêu cầu
 *       400:
 *         description: Email không hợp lệ
 */
router.post('/forgot-password', forgotPasswordValidator, validate, authController.forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Đặt lại mật khẩu
 *     description: Đặt lại mật khẩu bằng reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: Token không hợp lệ hoặc dữ liệu không hợp lệ
 */
router.post('/reset-password', resetPasswordValidator, validate, authController.resetPassword);

/**
 * @openapi
 * /api/auth/refresh-token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Làm mới access token
 *     description: Nhận refreshToken từ body theo đúng Postman collection.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Refresh token thành công
 *       401:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 */
router.post('/refresh-token', refreshValidator, validate, authController.refreshToken);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Đăng xuất
 *     description: Cần Bearer token và tokenValue trong body để revoke phiên.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       400:
 *         description: Thiếu tokenValue
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 */
router.post('/logout', requireAuth, authController.logout);

module.exports = router;