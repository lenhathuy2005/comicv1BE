# Comic Cultivation Backend

Backend Node.js + Express bám theo schema `comic_cultivation_system.sql` mà bạn đã upload. Schema này đã có đầy đủ các nhóm bảng lớn như `users`, `roles`, `comics`, `chapters`, `chapter_images`, `guilds`, `guild_members`, `chat_rooms`, `chat_messages`, `user_cultivation`, `afk_sessions`, `items`, `shop_items`, `user_vip`, `vip_levels`, `payment_transactions`... fileciteturn2file6 fileciteturn2file18

## Tính năng backend đã scaffold
- Auth: register, login, me, refresh, logout, forgot password, reset password
- Users: list user, detail user, update status, profile tổng hợp
- Comics: list comic, detail comic, list chapter, create/update comic
- Guilds: list, detail, create guild, gửi request tham gia, duyệt request, donate, announcements
- VIP: list VIP levels, my vip, list benefits
- AFK: config, start session, finish session, claim session
- Shop: list items, list shop items, buy item
- Chat: list rooms, room messages, send message
- Notifications: list user notifications, mark read

## Lưu ý quan trọng
Schema bạn gửi hiện **chưa có bảng `auth_tokens`**, trong khi auth forgot/reset/refresh token cần nơi lưu token. Vì vậy project có kèm migration:
- `sql/001_add_auth_tokens.sql`

## Cách chạy
1. `npm install`
2. Copy `.env.example` thành `.env`
3. Import DB hiện tại của bạn
4. Chạy migration `sql/001_add_auth_tokens.sql`
5. `npm run dev`

## Response format
```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```
