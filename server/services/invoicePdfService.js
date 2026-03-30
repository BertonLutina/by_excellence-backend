const { jsPDF } = require('jspdf');
const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const Offer = require('../models/Offer');

function parseOfferItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const v = JSON.parse(items);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @returns {Promise<string>} data URL (application/pdf)
 */
async function buildInvoiceDataUrl(payment, request, offer) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;

  doc.setFillColor(61, 66, 99);
  doc.rect(0, 0, pageW, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('By Excellence African Services', margin, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Plateforme de services événementiels', margin, 28);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', pageW - margin - 30, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const idStr = String(payment.id);
  const invoiceNumber = `FAC-${idStr.slice(-8).toUpperCase()}`;
  doc.text(`N° ${invoiceNumber}`, pageW - margin - 30, 26);
  const paidDate = payment.paid_date ? new Date(payment.paid_date) : new Date();
  doc.text(`Date : ${paidDate.toLocaleDateString('fr-FR')}`, pageW - margin - 30, 33);

  let y = 58;
  doc.setTextColor(61, 66, 99);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(request.client_name || '', margin, y);
  y += 6;
  doc.text(request.client_email || '', margin, y);
  y += 6;
  if (request.client_phone) {
    doc.text(request.client_phone, margin, y);
    y += 6;
  }

  let yP = 58;
  doc.setTextColor(61, 66, 99);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESTATAIRE', pageW / 2 + 10, yP);
  yP += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(request.provider_name || '', pageW / 2 + 10, yP);
  yP += 6;

  y = Math.max(y, yP) + 10;
  doc.setDrawColor(212, 168, 72);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setTextColor(61, 66, 99);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESTATION', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);

  const descLines = doc.splitTextToSize(request.service_description || '', pageW - margin * 2);
  doc.text(descLines, margin, y);
  y += descLines.length * 5 + 8;

  if (request.confirmed_date) {
    doc.text(
      `Date de prestation : ${new Date(request.confirmed_date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      margin,
      y
    );
    y += 10;
  }

  y += 4;
  doc.setFillColor(61, 66, 99);
  doc.rect(margin, y, pageW - margin * 2, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 4, y + 7);
  doc.text('Montant', pageW - margin - 30, y + 7);
  y += 10;

  doc.setFillColor(245, 245, 250);
  doc.rect(margin, y, pageW - margin * 2, 12, 'F');
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  let paymentLabel = 'Paiement final';
  if (payment.type === 'deposit') paymentLabel = 'Acompte';
  else if (payment.type === 'installment')
    paymentLabel = `Tranche ${payment.installment_index}/${payment.installment_total}`;

  const amt = Number(payment.amount);
  doc.text(paymentLabel, margin + 4, y + 8);
  doc.text(`${amt.toFixed(2)} €`, pageW - margin - 30, y + 8);
  y += 12;

  const items = offer ? parseOfferItems(offer.items) : [];
  if (items.length > 0) {
    y += 6;
    doc.setTextColor(61, 66, 99);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("Détail de l'offre :", margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    for (const item of items) {
      doc.text(`• ${item.label || ''}`, margin + 4, y);
      doc.text(`${Number(item.price || 0).toFixed(2)} €`, pageW - margin - 30, y);
      y += 6;
    }
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setTextColor(80, 80, 80);
    doc.text('Total de la prestation :', margin + 4, y);
    doc.text(`${Number(offer.total_amount || 0).toFixed(2)} €`, pageW - margin - 30, y);
  }

  y += 16;
  doc.setFillColor(212, 168, 72);
  doc.rect(pageW - margin - 70, y, 70, 16, 'F');
  doc.setTextColor(61, 66, 99);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL PAYÉ', pageW - margin - 66, y + 7);
  doc.text(`${amt.toFixed(2)} €`, pageW - margin - 66, y + 14);

  y += 24;
  doc.setFillColor(220, 255, 220);
  doc.roundedRect(margin, y, 50, 10, 2, 2, 'F');
  doc.setTextColor(0, 150, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYÉ', margin + 14, y + 7);

  const footerY = 280;
  doc.setDrawColor(212, 168, 72);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'By Excellence African Services — Plateforme de mise en relation de services événementiels',
    margin,
    footerY + 6
  );
  doc.text(
    `Facture générée le ${new Date().toLocaleDateString('fr-FR')} | Référence : ${invoiceNumber}`,
    margin,
    footerY + 12
  );

  return doc.output('datauristring');
}

/**
 * @param {number|string} paymentId
 * @param {{ user: { id: number, email: string, role?: string }}} ctx
 */
async function generateInvoicePdfForPayment(paymentId, ctx) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, code: 404, error: 'Payment not found' };

  const request = await ServiceRequest.findById(payment.request_id);
  if (!request) return { ok: false, code: 404, error: 'Request not found' };

  const Client = require('../models/Client');
  const client = await Client.findById(request.client_id);
  const isAdmin = ctx.user.role === 'admin';
  const isOwner = client && Number(client.user_id) === Number(ctx.user.id);
  if (!isAdmin && !isOwner) {
    return { ok: false, code: 403, error: 'Forbidden' };
  }

  const offer = payment.offer_id ? await Offer.findById(payment.offer_id) : null;
  const url = await buildInvoiceDataUrl(payment, request, offer);
  return { ok: true, url, success: true };
}

module.exports = { generateInvoicePdfForPayment, buildInvoiceDataUrl };
