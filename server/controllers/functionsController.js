/**
 * Stub implementations for frontend base44.functions.invoke(name, params).
 * Replace with real logic (Stripe, PDF, email) as needed.
 */
exports.invoke = async (req, res) => {
  try {
    const { name, params = {} } = req.body;
    if (!name) return res.status(400).json({ error: 'Function name required' });

    switch (name) {
      case 'generateInvoicePDF': {
        // Stub: return a minimal PDF as data URL; implement with pdf-lib or external service
        const minimalPdfBase64 = 'JVBERi0xLjcKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihJbnZvaWNlIHN0dWIpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjQ2IDAwMDAwIG4gCjAwMDAwMDAzMjMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MTIKJSVFT0YK';
        const dataUrl = `data:application/pdf;base64,${minimalPdfBase64}`;
        return res.json({ url: dataUrl, success: true });
      }
      case 'sendPaymentReminders': {
        // Stub: optional email sending; implement with your mailer
        return res.json({ sent: 0, message: 'Reminders sent' });
      }
      case 'createStripePayment': {
        // Stub: return client secret + commission split for Stripe Connect (application_fee_amount, etc.)
        const { payment_id } = params;
        if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
        const Payment = require('../models/Payment');
        const paymentCommissionService = require('../services/paymentCommissionService');
        const payment = await Payment.findById(payment_id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        let commissionBreakdown;
        try {
          commissionBreakdown = await paymentCommissionService.computeBreakdownForPayment(payment);
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Commission calculation failed' });
        }
        const baseUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
        const amountNum = Number(payment.amount);
        const feeCents = Math.round(commissionBreakdown.admin_commission_amount * 100);
        return res.json({
          data: {
            client_secret: `pi_placeholder_${payment_id}`,
            payment_intent_id: `pi_${payment_id}`,
            sessionUrl: `${baseUrl}/payment/placeholder?pi=${payment_id}`,
            amount: amountNum,
            commission: commissionBreakdown,
            /** Stripe: pass as application_fee_amount on PaymentIntent (smallest currency unit) when using Connect */
            stripe_application_fee_amount: feeCents,
            stripe_transfer_amount: Math.round(commissionBreakdown.provider_net_amount * 100),
          },
        });
      }
      case 'processRefund': {
        // Stub: mark payment as refunded; implement with Stripe + DB update
        const { payment_id } = params;
        return res.json({ success: true, refund_id: `re_${payment_id}` });
      }
      default:
        return res.status(404).json({ error: `Unknown function: ${name}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
