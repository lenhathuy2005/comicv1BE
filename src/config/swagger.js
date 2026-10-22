const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Comic Cultivation API',
      version: '1.0.0',
      description: 'API documentation for backend_project',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Đăng ký',
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Đăng nhập',
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Lấy thông tin user',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/auth/verify-email': {
        post: {
          tags: ['Auth'],
          summary: 'Xác thực email',
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Quên mật khẩu',
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Đặt lại mật khẩu',
        },
      },
      '/api/auth/refresh-token': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh token',
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Đăng xuất',
          security: [{ bearerAuth: [] }],
        },
      },

      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'Danh sách user',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Chi tiết user',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/users/{id}/status': {
        patch: {
          tags: ['Users'],
          summary: 'Cập nhật trạng thái user',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/comics': {
        get: {
          tags: ['Comics'],
          summary: 'Danh sách truyện',
        },
        post: {
          tags: ['Comics'],
          summary: 'Tạo truyện',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/comics/{id}': {
        get: {
          tags: ['Comics'],
          summary: 'Chi tiết truyện',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
        put: {
          tags: ['Comics'],
          summary: 'Cập nhật truyện',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/chapters': {
        post: {
          tags: ['Chapters'],
          summary: 'Tạo chapter',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/chapters/{id}': {
        get: {
          tags: ['Chapters'],
          summary: 'Chi tiết chapter',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
        put: {
          tags: ['Chapters'],
          summary: 'Cập nhật chapter',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/chapters/comic/{comicId}': {
        get: {
          tags: ['Chapters'],
          summary: 'Danh sách chapter theo comic',
          parameters: [
            {
              name: 'comicId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/vip/levels': {
        get: {
          tags: ['VIP'],
          summary: 'Danh sách VIP levels',
        },
      },
      '/api/vip/features': {
        get: {
          tags: ['VIP'],
          summary: 'Danh sách VIP features',
        },
      },
      '/api/vip/me': {
        get: {
          tags: ['VIP'],
          summary: 'Thông tin VIP của tôi',
          security: [{ bearerAuth: [] }],
        },
      },

      '/api/shop/items': {
        get: {
          tags: ['Shop'],
          summary: 'Danh sách shop items',
        },
      },

      '/api/afk/configs': {
        get: {
          tags: ['AFK'],
          summary: 'Danh sách AFK configs',
        },
      },
      '/api/afk/sessions': {
        post: {
          tags: ['AFK'],
          summary: 'Bắt đầu AFK session',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/afk/sessions/{id}/finish': {
        post: {
          tags: ['AFK'],
          summary: 'Kết thúc AFK session',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/afk/sessions/{id}/claim': {
        post: {
          tags: ['AFK'],
          summary: 'Nhận thưởng AFK',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/guilds': {
        get: {
          tags: ['Guilds'],
          summary: 'Danh sách guild',
          security: [{ bearerAuth: [] }],
        },
        post: {
          tags: ['Guilds'],
          summary: 'Tạo guild',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/guilds/{id}': {
        get: {
          tags: ['Guilds'],
          summary: 'Chi tiết guild',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/guilds/{id}/members': {
        get: {
          tags: ['Guilds'],
          summary: 'Danh sách thành viên guild',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/guilds/{id}/join-requests': {
        post: {
          tags: ['Guilds'],
          summary: 'Gửi yêu cầu vào guild',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/guilds/join-requests/{id}/approve': {
        post: {
          tags: ['Guilds'],
          summary: 'Duyệt yêu cầu vào guild',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },
      '/api/guilds/{id}/donations': {
        post: {
          tags: ['Guilds'],
          summary: 'Đóng góp guild',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/chat/rooms': {
        get: {
          tags: ['Chat'],
          summary: 'Danh sách chat rooms',
        },
      },
      '/api/chat/rooms/{id}/messages': {
        get: {
          tags: ['Chat'],
          summary: 'Danh sách tin nhắn',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
        post: {
          tags: ['Chat'],
          summary: 'Gửi tin nhắn',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/notifications/me': {
        get: {
          tags: ['Notifications'],
          summary: 'Thông báo của tôi',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/notifications/{id}/read': {
        patch: {
          tags: ['Notifications'],
          summary: 'Đánh dấu đã đọc',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
      },

      '/api/rankings': {
        get: {
          tags: ['Rankings'],
          summary: 'Danh sách bảng xếp hạng',
        },
      },
      '/api/rankings/types': {
        get: {
          tags: ['Rankings'],
          summary: 'Các loại ranking',
        },
      },
      '/api/rankings/me': {
        get: {
          tags: ['Rankings'],
          summary: 'Ranking của tôi',
        },
      },
      '/api/rankings/power': {
        get: {
          tags: ['Rankings'],
          summary: 'Ranking power',
        },
      },
      '/api/rankings/vip': {
        get: {
          tags: ['Rankings'],
          summary: 'Ranking vip',
        },
      },
      '/api/rankings/power/me': {
        get: {
          tags: ['Rankings'],
          summary: 'Power ranking của tôi',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/rankings/level/me': {
        get: {
          tags: ['Rankings'],
          summary: 'Level ranking của tôi',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/rankings/vip/me': {
        get: {
          tags: ['Rankings'],
          summary: 'VIP ranking của tôi',
          security: [{ bearerAuth: [] }],
        },
      },
      '/api/rankings/power/snapshot': {
        post: {
          tags: ['Rankings'],
          summary: 'Tạo power snapshot',
          security: [{ bearerAuth: [] }],
        },
      },
    },
  },

  apis: [
  './src/modules/*/routes/*.js',
  './src/routes.js',
],
};

module.exports = swaggerJsdoc(options);