// Security monitoring utility for IIFTL Backend
const crypto = require('crypto');

class SecurityMonitor {
  constructor() {
    this.securityEvents = [];
    this.failedAttempts = new Map();
    this.blockedIPs = new Set();
    this.maxFailedAttempts = 10;
    this.blockDuration = 30 * 60 * 1000; // 30 minutes
  }

  // Log security event
  logEvent(event) {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      type: event.type,
      ip: event.ip,
      userAgent: event.userAgent,
      path: event.path,
      method: event.method,
      userId: event.userId,
      details: event.details,
      severity: event.severity || 'info'
    };

    this.securityEvents.push(securityEvent);
    
    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY] ${securityEvent.type}: ${securityEvent.ip} - ${securityEvent.path}`);
    }

    return securityEvent;
  }

  // Track failed login attempts
  trackFailedLogin(ip, email) {
    const key = `${ip}:${email}`;
    const attempts = this.failedAttempts.get(key) || 0;
    this.failedAttempts.set(key, attempts + 1);

    this.logEvent({
      type: 'failed_login',
      ip,
      path: '/api/auth/login',
      method: 'POST',
      details: { email, attempts: attempts + 1 },
      severity: attempts + 1 >= this.maxFailedAttempts ? 'high' : 'medium'
    });

    // Block IP if too many failed attempts
    if (attempts + 1 >= this.maxFailedAttempts) {
      this.blockIP(ip);
      return false; // Blocked
    }

    return true; // Allowed
  }

  // Block IP address
  blockIP(ip) {
    this.blockedIPs.add(ip);
    this.logEvent({
      type: 'ip_blocked',
      ip,
      details: { reason: 'Too many failed login attempts' },
      severity: 'high'
    });

    // Remove from blocked list after block duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      this.logEvent({
        type: 'ip_unblocked',
        ip,
        details: { reason: 'Block duration expired' },
        severity: 'info'
      });
    }, this.blockDuration);
  }

  // Check if IP is blocked
  isIPBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  // Track successful login
  trackSuccessfulLogin(ip, userId, email) {
    // Clear failed attempts for this IP/email combination
    const key = `${ip}:${email}`;
    this.failedAttempts.delete(key);

    this.logEvent({
      type: 'successful_login',
      ip,
      userId,
      path: '/api/auth/login',
      method: 'POST',
      details: { email },
      severity: 'info'
    });
  }

  // Track suspicious activity
  trackSuspiciousActivity(event) {
    this.logEvent({
      ...event,
      severity: 'high'
    });
  }

  // Validate input for potential attacks
  validateInput(input, type) {
    const suspiciousPatterns = {
      sql: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript|onload|onerror|onclick)\b)/i,
      xss: /(<script|javascript:|vbscript:|onload|onerror|onclick|onmouseover|onfocus|onblur)/i,
      path: /(\.\.\/|\.\.\\|~\/|~\\|%2e%2e|%2e%2e%5c)/i,
      command: /(\b(cmd|command|powershell|bash|sh|exec|system|eval|setTimeout|setInterval)\b)/i
    };

    if (typeof input !== 'string') return true;

    for (const [attackType, pattern] of Object.entries(suspiciousPatterns)) {
      if (pattern.test(input)) {
        this.logEvent({
          type: 'suspicious_input',
          details: { 
            attackType, 
            input: input.substring(0, 100), // Truncate for logging
            validationType: type 
          },
          severity: 'high'
        });
        return false;
      }
    }

    return true;
  }

  // Generate security report
  generateReport() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = this.securityEvents.filter(
      event => new Date(event.timestamp) > last24Hours
    );

    const report = {
      timestamp: now.toISOString(),
      totalEvents: this.securityEvents.length,
      eventsLast24Hours: recentEvents.length,
      blockedIPs: this.blockedIPs.size,
      failedAttempts: this.failedAttempts.size,
      eventTypes: {},
      highSeverityEvents: recentEvents.filter(e => e.severity === 'high').length
    };

    // Count event types
    recentEvents.forEach(event => {
      report.eventTypes[event.type] = (report.eventTypes[event.type] || 0) + 1;
    });

    return report;
  }

  // Get security events (for admin dashboard)
  getEvents(limit = 100, severity = null) {
    let events = [...this.securityEvents];
    
    if (severity) {
      events = events.filter(event => event.severity === severity);
    }
    
    return events.slice(-limit);
  }

  // Clear old events
  clearOldEvents(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    this.securityEvents = this.securityEvents.filter(
      event => new Date(event.timestamp) > cutoff
    );
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

// Clean up old events daily
setInterval(() => {
  securityMonitor.clearOldEvents();
}, 24 * 60 * 60 * 1000);

module.exports = securityMonitor; 