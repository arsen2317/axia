<?php
/* Отправка писем через SMTP (Яндекс 360). Если SMTP не настроен — письмо сохраняется в data/outbox (тестовый режим). */
declare(strict_types=1);

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

        if (!$smtp) {
            /* тестовый режим: письмо не уходит, а складывается в data/outbox/*.eml */
            $m->preSend();
            ensure_dir(DATA . '/outbox');
            file_put_contents(DATA . '/outbox/' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml', $m->getSentMIMEMessage());
            return true;
        }
        return $m->send();
    } catch (Throwable $e) {
        log_error('mail: ' . $e->getMessage() . ' / ' . $m->ErrorInfo);
        return false;
    }
}

/* Простая вёрстка письма в стиле сайта */
function mail_layout(string $title, string $bodyHtml): string
{
    return '<!doctype html><html lang="ru"><body style="margin:0;padding:24px;background:#f2f1ec;font-family:Arial,Helvetica,sans-serif;color:#1e2f63">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px">'
        . '<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:bold;color:#2c4595">аксиа</td></tr>'
        . '<tr><td style="padding:8px 28px 0;font-size:20px;font-weight:bold">' . h($title) . '</td></tr>'
        . '<tr><td style="padding:12px 28px 28px;font-size:15px;line-height:1.5">' . $bodyHtml . '</td></tr>'
        . '</table></body></html>';
}

function mail_rows(array $rows): string
{
    $out = '<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5">';
    foreach ($rows as $k => $v) {
        if ($v === '' || $v === null) continue;
        $out .= '<tr><td style="padding:3px 16px 3px 0;color:#6b7aa8;vertical-align:top">' . h($k) . '</td><td style="padding:3px 0;white-space:pre-wrap">' . h((string)$v) . '</td></tr>';
    }
    return $out . '</table>';
}

function mail_text_rows(array $rows): string
{
    $out = '';
    foreach ($rows as $k => $v) if ($v !== '' && $v !== null) $out .= $k . ': ' . $v . "\n";
    return $out;
}
