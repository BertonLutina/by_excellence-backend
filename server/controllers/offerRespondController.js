const Offer = require('../models/Offer');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const { makeOfferActionToken } = require('../utils/offerActionToken');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
    .success { color: #0a0a5c; }
    .info { color: #0a0a5c; }
    .btn { background: #ffe342; color: #0a0a5c; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

exports.get = async (req, res) => {
  try {
    const offerId = req.query.offer_id;
    const action = req.query.action;
    const token = req.query.token;
    if (!offerId || !action || !token) {
      return res.status(400).send('Missing parameters');
    }

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).send('Offer not found');

    const request = await ServiceRequest.findById(offer.request_id);
    if (!request) return res.status(404).send('Request not found');

    const expected = makeOfferActionToken(offerId, request.client_email);
    if (token !== expected) return res.status(403).send('Invalid token');

    const appBase = FRONTEND_ORIGIN.replace(/\/$/, '');
    const detailUrl = `${appBase}/ClientRequestDetail?id=${offer.request_id}`;

    if (action === 'accept') {
      if (offer.status === 'accepted') {
        return res
          .status(200)
          .type('html')
          .send(
            page(
              'Offre déjà acceptée',
              `<h1 class="success">Offre déjà acceptée</h1><p>Cette offre avait déjà été acceptée.</p><a href="${detailUrl}" class="btn">Voir ma demande</a>`
            )
          );
      }

      await Offer.update(offerId, { status: 'accepted' });
      await ServiceRequest.update(offer.request_id, { status: 'offer_accepted' });

      const existingDeposit = await Payment.findAll({
        filters: { request_id: offer.request_id, offer_id: offer.id, type: 'deposit' },
        limit: 5,
      });
      if (existingDeposit.length === 0) {
        await Payment.create({
          request_id: offer.request_id,
          offer_id: offer.id,
          type: 'deposit',
          amount: Number(offer.deposit_amount || 0),
          status: 'pending',
        });
      }

      return res
        .status(200)
        .type('html')
        .send(
          page(
            'Offre acceptée',
            `<h1 class="success">✅ Offre acceptée !</h1>
            <p>Votre acceptation a été enregistrée avec succès.</p>
            <p>Vous allez recevoir les instructions pour le paiement de l'acompte.</p>
            <a href="${detailUrl}" class="btn">Voir ma demande</a>`
          )
        );
    }

    if (action === 'reject') {
      await Offer.update(offerId, { status: 'rejected' });
      await ServiceRequest.update(offer.request_id, { status: 'in_review' });
      return res
        .status(200)
        .type('html')
        .send(
          page(
            'Offre refusée',
            `<h1 class="info">Offre refusée</h1>
            <p>Votre refus a été enregistré. Le prestataire et notre équipe en sont informés.</p>
            <a href="${detailUrl}" class="btn">Voir ma demande</a>`
          )
        );
    }

    return res.status(400).send('Invalid action');
  } catch (err) {
    console.error('[offerRespond]', err);
    return res.status(500).send(`Error: ${err.message}`);
  }
};
