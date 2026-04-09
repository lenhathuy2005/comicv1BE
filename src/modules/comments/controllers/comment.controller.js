const ApiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const commentService = require('../services/comment.service');

exports.listComicComments = asyncHandler(async (req, res) => {
  const data = await commentService.listComicComments({
    comicId: Number(req.params.comicId),
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
  });

  return ApiResponse.success(res, data, 'Lấy comment theo comic thành công');
});

exports.listChapterComments = asyncHandler(async (req, res) => {
  const data = await commentService.listChapterComments({
    chapterId: Number(req.params.chapterId),
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
  });

  return ApiResponse.success(res, data, 'Lấy comment theo chapter thành công');
});

exports.listMyComments = asyncHandler(async (req, res) => {
  const data = await commentService.listMyComments({
    userId: req.user.id,
    page: req.query.page,
    limit: req.query.limit,
  });

  return ApiResponse.success(res, data, 'Lấy comment của tôi thành công');
});

exports.createComment = asyncHandler(async (req, res) => {
  const data = await commentService.createComment({
    userId: req.user.id,
    comicId: req.body.comic_id,
    chapterId: req.body.chapter_id,
    parentCommentId: req.body.parent_comment_id,
    content: req.body.content,
  });

  return ApiResponse.success(res, data, 'Tạo comment thành công', 201);
});

exports.updateMyComment = asyncHandler(async (req, res) => {
  const data = await commentService.updateMyComment({
    commentId: Number(req.params.id),
    userId: req.user.id,
    content: req.body.content,
  });

  return ApiResponse.success(res, data, 'Cập nhật comment thành công');
});

exports.deleteMyComment = asyncHandler(async (req, res) => {
  const data = await commentService.deleteMyComment({
    commentId: Number(req.params.id),
    userId: req.user.id,
  });

  return ApiResponse.success(res, data, 'Xóa comment thành công');
});