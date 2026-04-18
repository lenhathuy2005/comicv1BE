const { query } = require('../../../config/database');
const ApiError = require('../../../utils/ApiError');

const MIN_TOPUP_AMOUNT = 10000;

function calculateRewards(amount) {
  const numericAmount = Number(amount || 0);

  return {
    premiumGranted: Number((numericAmount / 100).toFixed(2)),
    vipExpGranted: Number((numericAmount / 1000).toFixed(2)),
  };
}

async function ensureTransactionExists(transactionId) {
  const rows = await query(
    `
    SELECT *
    FROM payment_transactions
    WHERE id = :transactionId
    LIMIT 1
    `,
    { transactionId }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy giao dịch');
  }

  return rows[0];
}

async function getPaymentPackages() {
  const rows = await query(
    `
    SELECT
      id,
      code,
      name,
      price_amount,
      currency_code,
      premium_reward,
      vip_exp_reward,
      bonus_percent,
      is_active,
      created_at,
      updated_at
    FROM payment_packages
    WHERE is_active = 1
    ORDER BY price_amount ASC, id ASC
    `
  );

  return {
    items: rows,
  };
}

async function getMyPayments(userId) {
  const rows = await query(
    `
    SELECT
      pt.id,
      pt.user_id,
      pt.payment_package_id,
      pt.external_txn_code,
      pt.payment_method,
      pt.request_amount,
      pt.amount,
      pt.currency_code,
      pt.payment_status,
      pt.payment_type,
      pt.premium_granted,
      pt.vip_exp_granted,
      pt.completed_at,
      pt.created_at,
      pt.updated_at,
      pp.code AS package_code,
      pp.name AS package_name
    FROM payment_transactions pt
    LEFT JOIN payment_packages pp ON pp.id = pt.payment_package_id
    WHERE pt.user_id = :userId
    ORDER BY pt.id DESC
    `,
    { userId }
  );

  return {
    items: rows,
  };
}

async function createTopup({ userId, amount, paymentMethod }) {
  amount = Number(amount);

  if (Number.isNaN(amount) || amount < MIN_TOPUP_AMOUNT) {
    throw new ApiError(400, `Số tiền nạp tối thiểu là ${MIN_TOPUP_AMOUNT}đ`);
  }

  if (!paymentMethod) {
    throw new ApiError(400, 'Thiếu payment_method');
  }

  const { premiumGranted, vipExpGranted } = calculateRewards(amount);
  const externalTxnCode = `TOPUP_${Date.now()}_${userId}`;

  await query(
    `
    INSERT INTO payment_transactions (
      user_id,
      payment_package_id,
      external_txn_code,
      payment_method,
      request_amount,
      amount,
      currency_code,
      payment_status,
      payment_type,
      premium_granted,
      vip_exp_granted,
      created_at,
      updated_at
    )
    VALUES (
      :userId,
      NULL,
      :externalTxnCode,
      :paymentMethod,
      :requestAmount,
      :amount,
      'VND',
      'pending',
      'topup',
      :premiumGranted,
      :vipExpGranted,
      NOW(),
      NOW()
    )
    `,
    {
      userId,
      externalTxnCode,
      paymentMethod,
      requestAmount: amount,
      amount,
      premiumGranted,
      vipExpGranted,
    }
  );

  const inserted = await query(
    `
    SELECT *
    FROM payment_transactions
    WHERE external_txn_code = :externalTxnCode
    LIMIT 1
    `,
    { externalTxnCode }
  );

  return {
    transaction: inserted[0],
    payment_url: null,
    qr_data: {
      method: paymentMethod,
      amount,
      external_txn_code: externalTxnCode,
    },
  };
}

async function confirmPayment({ userId, transactionId }) {
  if (transactionId === undefined || transactionId === null || Number.isNaN(transactionId)) {
  throw new ApiError(400, 'transactionId không hợp lệ');
  }

  const transaction = await ensureTransactionExists(transactionId);

  if (Number(transaction.user_id) !== Number(userId)) {
    throw new ApiError(403, 'Bạn không có quyền với giao dịch này');
  }

  if (transaction.payment_status === 'success') {
    throw new ApiError(400, 'Giao dịch đã được xác nhận trước đó');
  }

  if (
    transaction.payment_status === 'failed' ||
    transaction.payment_status === 'cancelled' ||
    transaction.payment_status === 'refunded'
  ) {
    throw new ApiError(400, 'Giao dịch này không thể xác nhận');
  }

  await query(
    `
    UPDATE payment_transactions
    SET payment_status = 'success',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = :transactionId
    `,
    { transactionId }
  );

  const updated = await query(
    `
    SELECT *
    FROM payment_transactions
    WHERE id = :transactionId
    LIMIT 1
    `,
    { transactionId }
  );

  return {
    transaction: updated[0],
  };
}

async function paymentCallback(payload) {
  const externalTxnCode = payload.external_txn_code || payload.txn_code || null;
  const paymentStatus = payload.payment_status || 'success';

  if (!externalTxnCode) {
    throw new ApiError(400, 'Thiếu external_txn_code');
  }

  const rows = await query(
    `
    SELECT *
    FROM payment_transactions
    WHERE external_txn_code = :externalTxnCode
    LIMIT 1
    `,
    { externalTxnCode }
  );

  if (!rows.length) {
    throw new ApiError(404, 'Không tìm thấy giao dịch');
  }

  const transaction = rows[0];

  if (transaction.payment_status === 'success') {
    return {
      transaction,
      skipped: true,
    };
  }

  await query(
    `
    UPDATE payment_transactions
    SET payment_status = :paymentStatus,
        completed_at = CASE WHEN :paymentStatus = 'success' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = :transactionId
    `,
    {
      paymentStatus,
      transactionId: transaction.id,
    }
  );

  const updated = await query(
    `
    SELECT *
    FROM payment_transactions
    WHERE id = :transactionId
    LIMIT 1
    `,
    { transactionId: transaction.id }
  );

  return {
    transaction: updated[0],
  };
}

module.exports = {
  getPaymentPackages,
  getMyPayments,
  createTopup,
  confirmPayment,
  paymentCallback,
};