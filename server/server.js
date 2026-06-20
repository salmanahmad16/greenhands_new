require('dotenv').config();

const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3456;

/* ── LEADS FILE ── */
const LEADS_FILE = path.join(__dirname, 'leads.json');
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');

function saveLeadToFile(lead) {
  const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  leads.unshift(lead);                      // newest first
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

/* ── RATE LIMITER (simple in-memory) ── */
const ipHits = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const hit = ipHits.get(ip) || { count: 0, firstHit: now };

  if (now - hit.firstHit > 60_000) {         // reset every 60 s
    ipHits.set(ip, { count: 1, firstHit: now });
    return next();
  }
  if (hit.count >= 5) {                       // max 5 submissions / minute / IP
    return res.status(429).json({ ok: false, message: 'Too many requests. Please wait a moment.' });
  }
  hit.count++;
  ipHits.set(ip, hit);
  next();
}

/* ── NODEMAILER TRANSPORTER ── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ── MIDDLEWARE ── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* Serve the static website from the parent folder */
app.use(express.static(path.join(__dirname, '..')));

/* ── VALIDATION HELPER ── */
function validate(body) {
  const errors = [];
  if (!body.firstName || body.firstName.trim().length < 2)
    errors.push('First name is required (min 2 characters).');
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
    errors.push('A valid email address is required.');
  return errors;
}

/* ═══════════════════════════════════════════════
   POST /api/contact
   Body: { firstName, lastName, email, phone,
           service, message }
═══════════════════════════════════════════════ */
app.post('/api/contact', rateLimit, async (req, res) => {
  const { firstName, lastName, email, phone, service, message } = req.body;

  /* Validate */
  const errors = validate(req.body);
  if (errors.length) {
    return res.status(400).json({ ok: false, message: errors[0] });
  }

  /* Build lead object */
  const lead = {
    id:         Date.now(),
    submittedAt: new Date().toISOString(),
    firstName:  firstName.trim(),
    lastName:   (lastName || '').trim(),
    email:      email.trim().toLowerCase(),
    phone:      (phone || '').trim(),
    service:    (service || 'Not specified').trim(),
    message:    (message || '').trim(),
    ip:         req.ip,
  };

  /* 1 — Save to leads.json */
  try {
    saveLeadToFile(lead);
  } catch (err) {
    console.error('Failed to save lead:', err.message);
  }

  /* 2 — Send notification email */
  const emailSent = await sendNotificationEmail(lead);

  /* 3 — Build WhatsApp deep link (returned to frontend) */
  const waNumber = process.env.WHATSAPP_NUMBER || '923314412354';
  const waText   = buildWhatsAppMessage(lead);
  const waUrl    = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  /* Respond */
  return res.status(200).json({
    ok:        true,
    message:   'Consultation request received! We will be in touch within 24 hours.',
    whatsapp:  waUrl,
    emailSent,
  });
});

/* ═══════════════════════════════════════════════
   GET /api/leads   (simple admin view — protect in production)
═══════════════════════════════════════════════ */
app.get('/api/leads', (req, res) => {
  try {
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    res.json({ ok: true, total: leads.length, leads });
  } catch {
    res.json({ ok: true, total: 0, leads: [] });
  }
});

/* ── HELPERS ── */
async function sendNotificationEmail(lead) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not set — skipping email.');
    return false;
  }
  try {
    await transporter.sendMail({
      from:    `"Green Hands Website" <${process.env.EMAIL_USER}>`,
      to:      process.env.NOTIFY_EMAIL || process.env.EMAIL_USER,
      replyTo: lead.email,
      subject: `🌿 New Consultation Request — ${lead.firstName} ${lead.lastName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f5ee;">
          <div style="background:#1A3A2A;padding:28px 32px;text-align:center;">
            <h1 style="color:#C9A84C;font-size:24px;margin:0;font-weight:400;">🌿 Green Hands</h1>
            <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:8px 0 0;">New Consultation Request</p>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#7a9484;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:140px;">Name</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#1a2a1e;font-size:14px;">${lead.firstName} ${lead.lastName}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#7a9484;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e8e0d0;font-size:14px;"><a href="mailto:${lead.email}" style="color:#1A3A2A;">${lead.email}</a></td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#7a9484;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Phone</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#1a2a1e;font-size:14px;">${lead.phone || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#7a9484;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Service</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e8e0d0;color:#1a2a1e;font-size:14px;">${lead.service}</td></tr>
              <tr><td style="padding:10px 0;color:#7a9484;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top;">Message</td>
                  <td style="padding:10px 0;color:#1a2a1e;font-size:14px;line-height:1.6;">${lead.message || '—'}</td></tr>
            </table>
            <div style="margin-top:28px;display:flex;gap:12px;">
              <a href="mailto:${lead.email}" style="display:inline-block;background:#1A3A2A;color:#C9A84C;padding:12px 24px;text-decoration:none;font-size:13px;font-weight:600;border-radius:2px;">Reply by Email</a>
              <a href="https://wa.me/${process.env.WHATSAPP_NUMBER || '923314412354'}?text=${encodeURIComponent('Hello ' + lead.firstName + ', thank you for reaching out to Green Hands!')}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;text-decoration:none;font-size:13px;font-weight:600;border-radius:2px;">Reply on WhatsApp</a>
            </div>
          </div>
          <div style="background:#0d1f17;padding:16px 32px;text-align:center;">
            <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">Submitted: ${new Date(lead.submittedAt).toLocaleString('en-PK', {timeZone:'Asia/Karachi'})} PKT · ID #${lead.id}</p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

function buildWhatsAppMessage(lead) {
  return [
    `*🌿 New Consultation Request — Green Hands*`,
    ``,
    `*Name:* ${lead.firstName} ${lead.lastName}`,
    `*Email:* ${lead.email}`,
    `*Phone:* ${lead.phone || 'Not provided'}`,
    `*Service:* ${lead.service}`,
    ``,
    `*Project Details:*`,
    lead.message || 'No details provided.',
    ``,
    `_Ref #${lead.id}_`,
  ].join('\n');
}

/* ── FALLBACK: serve index.html for any unknown route ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/* ── START ── */
app.listen(PORT, () => {
  console.log(`\n🌿 Green Hands server running at http://localhost:${PORT}`);
  console.log(`   Leads saved to: ${LEADS_FILE}`);
  if (!process.env.EMAIL_USER) {
    console.warn(`\n   ⚠️  No email credentials found.`);
    console.warn(`   Copy server/.env.example → server/.env and fill in your Gmail details.\n`);
  }
});
