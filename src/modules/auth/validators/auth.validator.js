const { body } = require('express-validator');

const registerValidator = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username là bắt buộc')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username phải từ 3 đến 50 ký tự'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email là bắt buộc')
    .isEmail()
    .withMessage('Email không hợp lệ'),

  body('password')
    .notEmpty()
    .withMessage('Password là bắt buộc')
    .isLength({ min: 6 })
    .withMessage('Password phải có ít nhất 6 ký tự'),

  body('displayName')
    .trim()
    .notEmpty()
    .withMessage('Display name là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name phải từ 2 đến 100 ký tự'),
];

const loginValidator = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Username hoặc email là bắt buộc'),

  body('password')
    .notEmpty()
    .withMessage('Password là bắt buộc'),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email là bắt buộc')
    .isEmail()
    .withMessage('Email không hợp lệ'),
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Token là bắt buộc'),

  body('newPassword')
    .notEmpty()
    .withMessage('Mật khẩu mới là bắt buộc')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
];

const refreshValidator = [
  body('refreshToken')
    .trim()
    .notEmpty()
    .withMessage('Refresh token là bắt buộc'),
];

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshValidator,
};