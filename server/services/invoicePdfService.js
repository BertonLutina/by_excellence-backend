const fs = require('fs');
const path = require('path');
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

function loadBrandLogoDataUrl() {
  const candidates = [
    path.join(__dirname, '../../public/logo_embelle.png'),
    path.join(__dirname, '../../../by-excellence/public/logo_embelle.png'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * @returns {Promise<string>} data URL (application/pdf)
 */
async function buildInvoiceDataUrl(payment, request, offer, extras = {}) {
  const { client = null, clientUser = null, provider = null } = extras;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const logo = loadBrandLogoDataUrl();

  doc.setFillColor(61, 66, 99);
  doc.rect(0, 0, pageW, 48, 'F');

  let textX = margin;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 10, 14, 14);
      textX = margin + 18;
    } catch {
      textX = margin;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('By Excellence AS', textX, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('By Excellence African Services', textX, 21);
  doc.text('Nieuwstraat 19, 9552 Borsbeke (Herzele), Belgique', textX, 27);
  doc.text('N° entreprise / TVA : BE 1029.915.811  ·  Assujetti à la TVA', textX, 32);
  doc.text('info@byexcellence-as.com  ·  byexcellence-as.com', textX, 37);

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

  const billedName = request.client_name || client?.full_name || clientUser?.full_name || '';
  const billedEmail = request.client_email || clientUser?.email || '';
  const billedPhone = request.client_phone || client?.phone || '';
  const billedVat = client?.vat_number ? String(client.vat_number).trim() : '';

  let y = 60;
  doc.setTextColor(61, 66, 99);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  if (billedName) {
    doc.text(billedName, margin, y);
    y += 6;
  }
  if (billedEmail) {
    doc.text(billedEmail, margin, y);
    y += 6;
  }
  if (billedPhone) {
    doc.text(billedPhone, margin, y);
    y += 6;
  }
  if (billedVat) {
    doc.text(`TVA : ${billedVat}`, margin, y);
    y += 6;
  }

  let yP = 60;
  doc.setTextColor(61, 66, 99);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESTATAIRE', pageW / 2 + 10, yP);
  yP += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(request.provider_name || provider?.display_name || '', pageW / 2 + 10, yP);
  yP += 6;
  if (provider?.vat_number) {
    doc.text(`TVA : ${String(provider.vat_number).trim()}`, pageW / 2 + 10, yP);
    yP += 6;
  }
  if (provider?.siret) {
    doc.text(`BCE : ${String(provider.siret).trim()}`, pageW / 2 + 10, yP);
    yP += 6;
  }
  if (provider?.phone) {
    doc.text(String(provider.phone).trim(), pageW / 2 + 10, yP);
    yP += 6;
  }

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
    'By Excellence AS — Nieuwstraat 19, 9552 Borsbeke (Herzele) — TVA BE 1029.915.811',
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

function invoiceNumberForPayment(payment) {
  return `FAC-${String(payment.id).slice(-8).toUpperCase()}`;
}

async function loadInvoiceContext(paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, code: 404, error: 'Payment not found' };

  const request = await ServiceRequest.findById(payment.request_id);
  if (!request) return { ok: false, code: 404, error: 'Request not found' };

  const Client = require('../models/Client');
  const User = require('../models/User');
  const Provider = require('../models/Provider');

  const client = request.client_id ? await Client.findById(request.client_id) : null;
  const clientUser = client?.user_id ? await User.findById(client.user_id) : null;
  const offer = payment.offer_id ? await Offer.findById(payment.offer_id) : null;
  const providerId = payment.provider_id || offer?.provider_id || request.provider_id;
  const provider = providerId ? await Provider.findById(providerId) : null;

  return { ok: true, payment, request, client, clientUser, offer, provider };
}

/**
 * Build PDF, persist invoice_url when missing, return buffer for email/download.
 */
async function ensurePaymentInvoiceStored(paymentId) {
  const ctx = await loadInvoiceContext(paymentId);
  if (!ctx.ok) return ctx;

  const { payment, request, client, clientUser, offer, provider } = ctx;
  const dataUrl = await buildInvoiceDataUrl(payment, request, offer, {
    client,
    clientUser,
    provider,
  });
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const invoiceNumber = invoiceNumberForPayment(payment);
  const filename = `facture-${invoiceNumber}.pdf`;

  let publicUrl = payment.invoice_url || null;
  if (!publicUrl) {
    const { uploadBuffer } = require('./objectStorage');
    const constants = require('../../constants/constant');
    const uploaded = await uploadBuffer(
      { buffer, mime: 'application/pdf', ext: '.pdf', entity: 'invoice' },
      constants
    );
    publicUrl = uploaded.publicUrl;
    await Payment.update(payment.id, { invoice_url: publicUrl });
  }

  return {
    ok: true,
    buffer,
    filename,
    invoiceNumber,
    publicUrl,
    payment,
    request,
  };
}

/**
 * @param {number|string} paymentId
 * @param {{ user: { id: number, email: string, role?: string }}} ctx
 */
async function generateInvoicePdfForPayment(paymentId, ctx) {
  const loaded = await loadInvoiceContext(paymentId);
  if (!loaded.ok) return loaded;

  const { payment, request, client, clientUser, offer, provider } = loaded;
  const isAdmin = ctx.user?.role === 'admin';
  const isOwner = client && Number(client.user_id) === Number(ctx.user?.id);
  const isProvider =
    ctx.user?.role === 'provider' &&
    provider &&
    Number(provider.user_id) === Number(ctx.user?.id);
  if (!isAdmin && !isOwner && !isProvider) {
    return { ok: false, code: 403, error: 'Forbidden' };
  }

  if (payment.invoice_url) {
    return {
      ok: true,
      url: payment.invoice_url,
      success: true,
      invoiceNumber: invoiceNumberForPayment(payment),
    };
  }

  const ensured = await ensurePaymentInvoiceStored(paymentId);
  if (!ensured.ok) return ensured;
  return {
    ok: true,
    url: ensured.publicUrl || `data:application/pdf;base64,${ensured.buffer.toString('base64')}`,
    success: true,
    invoiceNumber: ensured.invoiceNumber,
  };
}

module.exports = {
  generateInvoicePdfForPayment,
  buildInvoiceDataUrl,
  ensurePaymentInvoiceStored,
  invoiceNumberForPayment,
};
