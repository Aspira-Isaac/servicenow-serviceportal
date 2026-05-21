const { upsert } = require('../lib/idempotent');
const client = require('../lib/client');
const fs = require('fs');
const path = require('path');

// ── Header ────────────────────────────────────────────────────────────────────

const HEADER_TEMPLATE = `
<style>
  .ahc-nav-wrap { --ahc-primary: {{data.branding.primaryColor || '#1a2980'}}; --ahc-accent: {{data.branding.accentColor || '#cf1d25'}}; }
</style>

<div class="ahc-nav-wrap">
  <nav class="ahc-nav" role="navigation">
    <div class="ahc-nav__inner">

      <!-- Brand -->
      <a class="ahc-nav__brand" href="{{data.portalUrl}}?id=ahc_index">
        <img class="ahc-nav__logo-img" src="/cb8f9beb8762c1104c76ed7e0ebb35cc.iix" alt="Aspira" />
      </a>

      <!-- Desktop Nav Links -->
      <ul class="ahc-nav__links">
        <li><a href="{{data.portalUrl}}?id=ahc_kb_search" class="ahc-nav__link">Knowledge</a></li>
        <li><a href="{{data.portalUrl}}?id=ahc_submit_ticket" class="ahc-nav__link">Catalog</a></li>
        <li><a href="{{data.portalUrl}}?id=ticket_list" class="ahc-nav__link">My Tickets</a></li>
      </ul>

      <!-- Right side: notifications + user -->
      <div class="ahc-nav__right">
        <!-- Notification bell -->
        <button class="ahc-nav__notif-btn" type="button" aria-label="Notifications">
          <i class="fa fa-bell"></i>
          <span class="ahc-nav__notif-badge" ng-if="data.notifCount">{{data.notifCount}}</span>
        </button>

        <!-- Divider -->
        <span class="ahc-nav__divider"></span>

        <!-- User pill -->
        <div class="ahc-nav__user" ng-if="data.isLoggedIn">
          <div class="ahc-nav__avatar" ng-style="{'background': data.avatarColor}">
            {{data.userInitials}}
          </div>
          <span class="ahc-nav__username">{{data.userName}}</span>
        </div>
        <a class="ahc-nav__link" href="login.do" ng-if="!data.isLoggedIn">
          <i class="fa fa-sign-in"></i> Sign In
        </a>
      </div>

    </div>
  </nav>
</div>
`.trim();

const HEADER_CSS = `
/* Aspira Help Center — Navbar v2 */
.ahc-nav-wrap {
  --ahc-primary: #1a2980;
  --ahc-accent:  #cf1d25;
}
.ahc-nav {
  background: var(--ahc-primary);
  height: 56px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.22);
  position: relative;
  z-index: 100;
}
.ahc-nav__inner {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  gap: 0;
}

/* Brand */
.ahc-nav__brand {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  -ms-flex-negative: 0;
  flex-shrink: 0;
  margin-right: 32px;
}
.ahc-nav__brand:hover { text-decoration: none; }
.ahc-nav__logo-img {
  height: 36px;
  width: auto;
  -ms-flex-negative: 0;
  flex-shrink: 0;
  display: block;
}

/* Nav links */
.ahc-nav__links {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 4px;
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
}
.ahc-nav__links li { display: block; }

.ahc-nav__link {
  color: rgba(255,255,255,0.8);
  font-size: 0.875em;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 4px;
  -webkit-transition: all 0.18s;
  transition: all 0.18s;
  text-decoration: none;
  display: block;
  white-space: nowrap;
}
.ahc-nav__link:hover {
  color: #fff;
  background: rgba(255,255,255,0.12);
  text-decoration: none;
}

/* Right side */
.ahc-nav__right {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  gap: 12px;
  -ms-flex-negative: 0;
  flex-shrink: 0;
}

/* Notification bell */
.ahc-nav__notif-btn {
  position: relative;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  color: rgba(255,255,255,0.85);
  font-size: 0.9em;
  cursor: pointer;
  -webkit-transition: all 0.18s;
  transition: all 0.18s;
  padding: 0;
}
.ahc-nav__notif-btn:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}
.ahc-nav__notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--ahc-accent);
  color: #fff;
  font-size: 0.62em;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  padding: 0 4px;
  border: 1.5px solid var(--ahc-primary);
  line-height: 1;
}

/* Divider */
.ahc-nav__divider {
  width: 1px;
  height: 22px;
  background: rgba(255,255,255,0.2);
  display: block;
}

/* User pill */
.ahc-nav__user {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  gap: 9px;
  cursor: default;
}
.ahc-nav__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #7c3aed;
  color: #fff;
  font-size: 0.72em;
  font-weight: 700;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  letter-spacing: 0.5px;
  border: 2px solid rgba(255,255,255,0.3);
  -ms-flex-negative: 0;
  flex-shrink: 0;
}
.ahc-nav__username {
  color: rgba(255,255,255,0.9);
  font-size: 0.875em;
  font-weight: 500;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
`.trim();

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_TEMPLATE = `
<footer class="ahc-footer">
  <div class="container">
    <div class="ahc-footer__inner">
      <div class="ahc-footer__brand">
        <img class="ahc-footer__logo-img" src="/cb8f9beb8762c1104c76ed7e0ebb35cc.iix" alt="Aspira" />
      </div>
      <div class="ahc-footer__links">
        <a href="/help?id=ahc_submit_ticket">Submit a Ticket</a>
        <a href="/help?id=ahc_kb_search">Knowledge Base</a>
      </div>
      <p class="ahc-footer__copy">&copy; Aspira Connect. All rights reserved.</p>
    </div>
  </div>
</footer>
`.trim();

const FOOTER_CSS = `
.ahc-footer {
  background: #111827;
  padding: 28px 0 20px;
  margin-top: 48px;
  border-top: 3px solid #1a2980;
}
.ahc-footer__inner {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -ms-flex-wrap: wrap;
  flex-wrap: wrap;
  gap: 20px;
}
.ahc-footer__brand {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  gap: 10px;
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
}
.ahc-footer__logo-img { height: 28px; width: auto; display: block; opacity: 0.75; }
.ahc-footer__links { display: -webkit-box; display: -ms-flexbox; display: flex; gap: 20px; }
.ahc-footer__links a { color: rgba(255,255,255,0.45); font-size: 0.8em; transition: color 0.2s; }
.ahc-footer__links a:hover { color: rgba(255,255,255,0.8); text-decoration: none; }
.ahc-footer__copy { color: rgba(255,255,255,0.25); font-size: 0.75em; margin: 0; width: 100%; }
`.trim();

// ── Server script for the header (reads user + branding) ─────────────────────
const HEADER_SERVER = fs.readFileSync(
  path.join(__dirname, '..', 'widgets', 'ahc-header-server.js'), 'utf8'
);

module.exports = async function deployHeaderFooter(ctx) {
  const header = await upsert('sp_header_footer', 'name', 'Aspira Help Center Header', {
    name: 'Aspira Help Center Header',
    template: HEADER_TEMPLATE,
    css: HEADER_CSS,
    script: HEADER_SERVER,
    public: true
  });
  ctx.headerSysId = header.sys_id;
  console.log(`  Header sys_id: ${header.sys_id}`);

  const footer = await upsert('sp_header_footer', 'name', 'Aspira Help Center Footer', {
    name: 'Aspira Help Center Footer',
    template: FOOTER_TEMPLATE,
    css: FOOTER_CSS,
    public: true
  });
  ctx.footerSysId = footer.sys_id;
  console.log(`  Footer sys_id: ${footer.sys_id}`);

  // Wire header/footer into the theme (and ensure navbar_fixed is on)
  if (ctx.themeSysId) {
    await client.patch(`/api/now/table/sp_theme/${ctx.themeSysId}`, {
      header: ctx.headerSysId,
      footer: ctx.footerSysId,
      navbar_fixed: true,
      footer_fixed: false
    });
    console.log(`  Theme updated with header/footer`);
  }
};

if (require.main === module) {
  require('dotenv').config();
  const ctx = {};
  module.exports(ctx).then(() => console.log('Done', ctx)).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
