<?php
/* Отправка писем через SMTP (Яндекс 360). Если SMTP не настроен — письмо сохраняется в data/outbox (тестовый режим). */
declare(strict_types=1);
defined('ROOT') || exit;

require_once ROOT . '/lib/vendor/PHPMailer/Exception.php';
require_once ROOT . '/lib/vendor/PHPMailer/PHPMailer.php';
require_once ROOT . '/lib/vendor/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

/**
 * @param string|string[] $to
 * @param array $opts reply_to, attachments: [[name, content, mime]]
 */
function send_mail($to, string $subject, string $html, string $text, array $opts = []): bool
{
    $m = new PHPMailer(true);
    $m->CharSet = 'UTF-8';
    try {
        $smtp = cfg('mail.smtp_user') !== '' && cfg('mail.smtp_pass') !== '';
        if ($smtp) {
            $m->isSMTP();
            $m->Host = (string)cfg('mail.smtp_host');
            $m->Port = (int)cfg('mail.smtp_port');
            $m->SMTPAuth = true;
            $m->Username = (string)cfg('mail.smtp_user');
            $m->Password = (string)cfg('mail.smtp_pass');
            $m->SMTPSecure = $m->Port === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
            $m->Timeout = 15;
        }
        $m->setFrom((string)cfg('mail.from'), (string)cfg('mail.from_name'));
        foreach ((array)$to as $addr) $m->addAddress($addr);
        if (!empty($opts['reply_to'])) $m->addReplyTo($opts['reply_to'][0], $opts['reply_to'][1] ?? '');
        $m->Subject = $subject;
        $m->isHTML(true);
        $m->Body = $html;
        $m->AltBody = $text;
        foreach ($opts['attachments'] ?? [] as [$name, $content, $mime]) $m->addStringAttachment($content, $name, PHPMailer::ENCODING_BASE64, $mime);
        /* логотип в шапке письма — вложенной картинкой */
        if (str_contains($html, 'cid:axia-logo') && is_file(ROOT . '/assets/img/mail-logo.png')) {
            $m->addEmbeddedImage(ROOT . '/assets/img/mail-logo.png', 'axia-logo', 'axia.png', PHPMailer::ENCODING_BASE64, 'image/png');
        }

        if (!$smtp) {
            /* SMTP не настроен. Локально (php -S) письмо складывается в data/outbox; на настоящем сервере —
               не сохраняется нигде (в письмах персональные данные), отправка считается неудачной */
            if (PHP_SAPI !== 'cli-server') {
                log_error('mail: SMTP не настроен, письмо не отправлено');
                return false;
            }
            $m->preSend();
            ensure_dir(DATA . '/outbox');
            file_put_contents(DATA . '/outbox/' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml', $m->getSentMIMEMessage());
            return true;
        }
        return $m->send();
    } catch (Throwable $e) {
        /* без адресов и текста письма: в журнал не попадают персональные данные */
        log_error('mail: ' . preg_replace('/\S+@\S+/', '[email]', $e->getMessage()));
        return false;
    }
}

/* Простая вёрстка письма в стиле сайта */
/* ---- Оформление писем ----
   Один шрифт (системный), три размера (22 — заголовок, 15 — текст, 13 — подписи), два цвета текста
   (основной и приглушённый) и фирменный синий — только для кнопки и логотипа. Логотип — картинка во вложении
   письма (cid:axia-logo, assets/img/mail-logo.png): так он виден и там, где внешние картинки отключены. */

const MAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MAIL_INK = '#1c2333';
const MAIL_MUTED = '#7b8190';
const MAIL_LINE = '#e9e8e3';
const MAIL_ACCENT = '#2c4595';

function mail_layout(string $title, string $bodyHtml): string
{
    $f = 'font-family:' . MAIL_FONT . ';';
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="light"><title>' . h($title) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f4f3ef;' . $f . '">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef"><tr><td align="center" style="padding:32px 16px">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px">'
        . '<tr><td style="padding:36px 40px 0"><img src="cid:axia-logo" width="108" height="20" alt="аксиа" style="display:block;border:0;width:108px;height:20px"></td></tr>'
        . '<tr><td style="padding:32px 40px 0;' . $f . 'font-size:22px;line-height:28px;font-weight:600;color:' . MAIL_INK . '">' . h($title) . '</td></tr>'
        . '<tr><td style="padding:16px 40px 40px;' . $f . 'font-size:15px;line-height:24px;color:' . MAIL_INK . '">' . $bodyHtml . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/** Абзац. $muted — приглушённый мелкий текст (подписи, пояснения) */
function mail_p(string $html, bool $muted = false): string
{
    return '<p style="margin:0 0 16px;' . ($muted ? 'font-size:13px;line-height:20px;color:' . MAIL_MUTED : 'font-size:15px;line-height:24px;color:' . MAIL_INK) . '">' . $html . '</p>';
}

/** Ссылка в тексте: цвет текста вокруг, подчёркнута */
function mail_link(string $url, string $label, bool $muted = false): string
{
    return '<a href="' . h($url) . '" style="color:' . ($muted ? MAIL_MUTED : MAIL_INK) . ';text-decoration:underline">' . h($label) . '</a>';
}

function mail_button(string $url, string $label): string
{
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:' . MAIL_ACCENT . '">'
        . '<a href="' . h($url) . '" style="display:inline-block;padding:13px 24px;font-family:' . MAIL_FONT . ';font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">' . h($label) . '</a>'
        . '</td></tr></table>';
}

/** Подпись и значение друг под другом, между строками — тонкие линии */
function mail_rows(array $rows): string
{
    $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-top:1px solid ' . MAIL_LINE . '">';
    foreach ($rows as $k => $v) {
        if ($v === '' || $v === null) continue;
        $out .= '<tr><td style="padding:12px 0;border-bottom:1px solid ' . MAIL_LINE . ';font-family:' . MAIL_FONT . '">'
            . '<div style="font-size:13px;line-height:20px;color:' . MAIL_MUTED . '">' . h($k) . '</div>'
            . '<div style="font-size:15px;line-height:24px;color:' . MAIL_INK . ';white-space:pre-wrap">' . h((string)$v) . '</div></td></tr>';
    }
    return $out . '</table>';
}

function mail_text_rows(array $rows): string
{
    $out = '';
    foreach ($rows as $k => $v) if ($v !== '' && $v !== null) $out .= $k . ': ' . $v . "\n";
    return $out;
}
