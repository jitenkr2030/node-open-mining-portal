# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in NOMP v2, please report it by:

1. **DO NOT** open a public issue
2. Email details to: [security contact]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Features

### Authentication
- Admin endpoints require bearer token authentication
- Configurable password requirements

### Rate Limiting
- API rate limiting prevents abuse
- Configurable limits per endpoint

### Input Validation
- All inputs validated with Joi schemas
- SQL injection prevention
- XSS protection

### Network Security
- IP banning for malicious miners
- Automatic ban for invalid share spam
- Connection limits per pool

### Logging
- All security events logged
- Failed authentication attempts tracked
- Suspicious activity monitoring

## Best Practices

1. **Change Default Passwords**
   - Update `ADMIN_PASSWORD` in `.env`
   - Use strong, unique passwords

2. **Firewall Configuration**
   - Only expose necessary ports
   - Restrict Redis access to localhost
   - Use firewall rules for protection

3. **Keep Updated**
   - Regularly update Node.js
   - Update dependencies: `npm update`
   - Check security advisories: `npm audit`

4. **Secure Redis**
   - Set Redis password
   - Bind to localhost only
   - Enable Redis ACLs if available

5. **Monitor Logs**
   - Regularly review logs in `logs/`
   - Set up alerts for suspicious activity
   - Monitor error rates

6. **HTTPS**
   - Use reverse proxy (nginx) with SSL
   - Enforce HTTPS for API access
   - Use Let's Encrypt for free SSL

## Security Checklist

- [ ] Changed default admin password
- [ ] Configured firewall rules
- [ ] Secured Redis with password
- [ ] Set up HTTPS with reverse proxy
- [ ] Configured rate limiting
- [ ] Enabled IP banning
- [ ] Set up log monitoring
- [ ] Regular security audits scheduled
