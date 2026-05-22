const { upsert } = require('../lib/idempotent');
const client = require('../lib/client');
const fs = require('fs');
const path = require('path');

// ── Header ────────────────────────────────────────────────────────────────────

const HEADER_TEMPLATE = `
<style>
  .ahc-nav-wrap { --ahc-primary: {{data.branding.primaryColor || '#1a2980'}}; --ahc-accent: {{data.branding.accentColor || '#cf1d25'}}; }

  /* ── Global link color ──────────────────────────────────────────────────── */
  a, a:visited { color: #1a2980 !important; }
  a:hover, a:focus { color: #141f6a !important; }
  /* Restore navbar and footer link colors */
  .ahc-nav__brand, .ahc-nav__brand:visited,
  .ahc-nav__link, .ahc-nav__link:visited { color: #ffffff !important; }
  .ahc-nav__link:hover, .ahc-nav__link:focus { color: rgba(255,255,255,0.7) !important; }
  .ahc-footer__link, .ahc-footer__link:visited { color: rgba(255,255,255,0.45) !important; }
  .ahc-footer__link:hover { color: rgba(255,255,255,0.8) !important; }

  /* ── Breadcrumbs ─────────────────────────────────────────────────────────── */
  .breadcrumb > li > a,
  .breadcrumb > li > a:visited,
  .breadcrumb > li > span > a { color: #1a2980 !important; }
  .breadcrumb > li > a:hover  { color: #141f6a !important; }

  /* ── State color text ────────────────────────────────────────────────────── */
  .text-active, .text-primary { color: #1a2980 !important; }

  /* ── Catalog item form: submit button ───────────────────────────────────── */
  .btn-danger, .btn-danger:focus {
    background-color: #1a2980 !important; border-color: #141f6a !important; color: #fff !important;
    border-radius: 8px !important; font-weight: 600 !important;
    box-shadow: 0 2px 8px rgba(26,41,128,0.22) !important;
    transition: background 0.15s, box-shadow 0.15s !important;
  }
  .btn-danger:hover, .btn-danger:active {
    background-color: #141f6a !important; border-color: #0e1550 !important; color: #fff !important;
    box-shadow: 0 4px 14px rgba(26,41,128,0.32) !important;
  }

  /* ── Catalog item form: panel, fields, labels ────────────────────────────── */
  /* Use .panel.panel-default > to beat Bootstrap's .panel-default > specificity */
  .panel.panel-default > .panel-heading {
    background: #fff !important; border-bottom: 1px solid #e8edf8 !important;
    padding: 24px 28px 20px !important; border-radius: 0 !important;
  }
  .panel.panel-default > .panel-heading h1,
  .panel.panel-default > .panel-heading h2,
  .panel.panel-default > .panel-heading h3 {
    font-size: 21px !important; font-weight: 700 !important; color: #0f172a !important;
    margin: 0 0 6px !important; line-height: 1.3 !important;
  }
  .panel.panel-default > .panel-heading p,
  .panel.panel-default > .panel-heading small {
    color: #64748b !important; font-size: 13px !important; margin: 0 !important; display: block;
  }
  .panel.panel-default > .panel-body { background: #fff !important; padding: 24px 28px !important; }
  .panel.panel-default > .panel-footer {
    background: #f8fafc !important; border-top: 1px solid #e8edf8 !important;
    padding: 14px 28px !important;
  }

  /* Form fields */
  .form-control {
    border: 1.5px solid #e2e8f0 !important; border-radius: 7px !important;
    background: #fff !important; color: #1e293b !important;
    box-shadow: none !important; transition: border-color 0.15s, box-shadow 0.15s !important;
    font-size: 13.5px !important;
  }
  .form-control:focus { border-color: #1a2980 !important; box-shadow: 0 0 0 3px rgba(26,41,128,0.09) !important; }
  .form-group > label {
    font-size: 11px !important; font-weight: 600 !important; color: #64748b !important;
    text-transform: uppercase !important; letter-spacing: 0.5px !important; margin-bottom: 5px !important;
  }

  /* Form table (multi-row variables like Closure Details) */
  .form-control table, .catalog-variables table, .sp-table {
    border-collapse: collapse !important; width: 100% !important;
  }
  table thead th {
    background: #f1f5f9 !important; color: #475569 !important;
    font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important;
    letter-spacing: 0.5px !important; padding: 9px 12px !important; border: none !important;
    border-bottom: 2px solid #e2e8f0 !important;
  }
  table tbody td { padding: 8px 12px !important; border: none !important; border-bottom: 1px solid #f1f5f9 !important; font-size: 13px !important; }

  /* "Add" + "Remove All" buttons in multi-row variables */
  .btn-primary { background: #1a2980 !important; border-color: #141f6a !important; color: #fff !important; border-radius: 6px !important; }
  .btn-primary:hover { background: #141f6a !important; }
  .btn-default { border: 1.5px solid #e2e8f0 !important; color: #475569 !important; background: #fff !important; border-radius: 6px !important; }
  .btn-default:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }

  /* Required asterisk — keep red for semantic clarity */
  .mandatory-fields-red { color: #cf1d25 !important; }

  /* All label variants in required-info sidebar → navy pills */
  .label-danger, .label-primary, .label-info, .label-warning, .label-success, .label-default {
    background-color: #1a2980 !important; border-color: #141f6a !important; color: #fff !important;
    border-radius: 20px !important; padding: 3px 10px !important;
    font-size: 11px !important; font-weight: 500 !important;
  }

  /* ── Catalog page wrapper — white, no background ─────────────────────────── */
  #sc_category_page { background: transparent; }
  #sc_category_page > .row { padding-top: 8px; }

  /* ── Catalog search bar ──────────────────────────────────────────────────── */
  .input-group .form-control {
    border-radius: 8px 0 0 8px !important; border: 1.5px solid #e2e8f0 !important;
    font-size: 0.875em !important; padding: 9px 14px !important; background: #fff !important;
    box-shadow: none !important; color: #1e293b !important;
  }
  .input-group .form-control:focus { border-color: #1a2980 !important; }
  .input-group-btn .btn,
  .input-group-btn .btn-default {
    background: #1a2980 !important; border: 1.5px solid #1a2980 !important;
    color: #fff !important; border-radius: 0 8px 8px 0 !important;
    padding: 9px 16px !important;
  }
  .input-group-btn .btn:hover { background: #141f6a !important; border-color: #141f6a !important; }

  /* ── Category sidebar ────────────────────────────────────────────────────── */
  .category-widget,
  .category-widget .panel { border: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; }
  /* Sidebar heading: override the form panel-heading rule above */
  .category-widget .panel.panel-default > .panel-heading,
  .category-widget .panel-heading { background: transparent !important; border: none !important; padding: 0 4px 12px !important; box-shadow: none !important; }
  .category-widget .panel-heading .panel-title {
    font-size: 10px !important; font-weight: 700 !important; text-transform: uppercase !important;
    letter-spacing: 1.4px !important; color: #94a3b8 !important;
  }
  .category-widget .list-group { box-shadow: none !important; border-radius: 0 !important; margin-bottom: 0 !important; }
  .category-widget .list-group-item,
  .category-widget .group-item {
    background: transparent !important; border: none !important; border-radius: 8px !important;
    padding: 9px 14px !important; font-size: 13.5px !important; color: #475569 !important;
    cursor: pointer; transition: background 0.12s, color 0.12s, padding-left 0.12s;
    margin-bottom: 1px; border-left: 2px solid transparent !important;
  }
  .category-widget .list-group-item:hover,
  .category-widget .group-item:hover {
    background: #eef2ff !important; color: #1a2980 !important;
    border-left-color: #a5b4fc !important; padding-left: 16px !important;
  }
  .category-widget [aria-current="true"],
  .category-widget .text-active,
  .category-widget [class*="sc_category_treeitem"][aria-current="true"] {
    background: #e8edf8 !important; color: #1a2980 !important;
    font-weight: 600 !important; border-left-color: #1a2980 !important;
    padding-left: 16px !important;
  }

  /* ── Catalog category title + view toggle ────────────────────────────────── */
  #sc_category_page > .row > .col-xs-9 > h2,
  [id="sc_category_page"] h2 {
    font-size: 20px !important; font-weight: 700 !important; color: #0f172a !important;
    margin: 0 0 20px !important; letter-spacing: -0.3px;
  }
  .tab-card-padding { color: #94a3b8 !important; padding: 4px 6px !important; border-radius: 4px; transition: color 0.12s; }
  .tab-card-padding.active, .tab-card-padding:hover { color: #1a2980 !important; }

  /* ── Catalog item cards ──────────────────────────────────────────────────── */
  .item-card-column { padding: 6px !important; }
  .item-card-column .panel,
  .item-card-column .sc-panel {
    border: 1.5px solid #e8edf8 !important; border-radius: 12px !important;
    box-shadow: 0 1px 4px rgba(15,23,42,0.05) !important;
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease !important;
    overflow: hidden !important; background: #fff !important;
    border-top: 3px solid #1a2980 !important;
  }
  .item-card-column .panel:hover,
  .item-card-column .sc-panel:hover {
    box-shadow: 0 8px 28px rgba(26,41,128,0.13) !important;
    border-top-color: #4f6ef7 !important; border-color: #c7d2fe !important;
    transform: translateY(-3px) !important;
  }
  .item-card-column .panel-body { padding: 20px 20px 14px !important; }
  .item-card-column .catalog-item-name {
    font-size: 14px !important; font-weight: 700 !important; color: #1a2980 !important;
    margin-bottom: 8px !important; text-decoration: none !important; line-height: 1.35 !important;
    display: block !important;
  }
  .item-card-column .catalog-item-name:hover { color: #141f6a !important; }
  .item-card-column .item-short-desc {
    font-size: 12.5px !important; color: #64748b !important;
    line-height: 1.55 !important; margin: 0 !important;
  }
  .item-card-column .panel-footer {
    background: #f8fafc !important; border-top: 1px solid #e8edf8 !important;
    padding: 10px 20px !important;
  }
  .item-card-column .panel-footer a {
    font-size: 12px !important; font-weight: 600 !important; color: #1a2980 !important;
    text-decoration: none !important; text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
  }
  .item-card-column .panel-footer a:hover { color: #4f6ef7 !important; }
</style>

<div class="ahc-nav-wrap"
     ng-init="
       $root.currentPageId = '';
       $root.$on('$locationChangeStart',   function(){ $root.ahcBarLoading = true; $root.currentPageId = ''; });
       $root.$on('$locationChangeSuccess', function(e, newUrl){
         $root.ahcBarLoading = false;
         $root.ahcOverlay = false;
         var m = newUrl && newUrl.match(/[?&]id=([^&]+)/);
         $root.currentPageId = m ? m[1] : '';
       });
       $root.$on('$locationChangeError',   function(){ $root.ahcBarLoading = false; $root.ahcOverlay = false; });
     ">
  <!-- Page loading bar (fires on every location change, including filter param updates) -->
  <div class="ahc-nav__loading-bar" ng-class="{'ahc-nav__loading-bar--on': $root.ahcBarLoading}"></div>

  <nav class="ahc-nav" role="navigation">
    <div class="ahc-nav__inner">

      <!-- Brand -->
      <a class="ahc-nav__brand" href="{{data.portalUrl}}?id=ahc_index">
        <img class="ahc-nav__logo-img" src="/cb8f9beb8762c1104c76ed7e0ebb35cc.iix" alt="Aspira" />
      </a>

      <!-- Desktop Nav Links -->
      <ul class="ahc-nav__links">
        <!-- KB hidden until ready: <li><a href="{{data.portalUrl}}?id=ahc_kb_search" class="ahc-nav__link">Knowledge</a></li> -->
        <li><a href="{{data.portalUrl}}?id=sc_category&catalog_id=-1" class="ahc-nav__link">Catalog</a></li>
        <li><a href="{{data.portalUrl}}?id=ticket_list" class="ahc-nav__link" ng-click="$root.currentPageId !== 'ticket_list' && ($root.ahcOverlay = true)">My Tickets</a></li>
      </ul>

      <!-- Right side: notifications + user -->
      <div class="ahc-nav__right">
        <!-- Notification bell -->
        <button class="ahc-nav__notif-btn" type="button" aria-label="Notifications"
                ng-click="$root.ahcNotifOpen = !$root.ahcNotifOpen">
          <i class="fa fa-bell"></i>
          <span class="ahc-nav__notif-badge" ng-if="data.notifCount && !$root.ahcNotifOpen">{{data.notifCount}}</span>
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

<!-- Notification backdrop — click outside to close -->
<div class="ahc-notif-backdrop" ng-if="$root.ahcNotifOpen" ng-click="$root.ahcNotifOpen = false"></div>

<!-- Notification panel -->
<div class="ahc-notif-panel" ng-if="$root.ahcNotifOpen">
  <div class="ahc-notif-panel__header">
    <span class="ahc-notif-panel__title">Notifications</span>
    <button class="ahc-notif-panel__close" ng-click="$root.ahcNotifOpen = false" type="button">
      <i class="fa fa-times"></i>
    </button>
  </div>

  <div class="ahc-notif-panel__list">
    <!-- Empty state -->
    <div class="ahc-notif-panel__empty" ng-if="!data.notifications || !data.notifications.length">
      <i class="fa fa-bell-o ahc-notif-panel__empty-icon"></i>
      <p>You're all caught up</p>
    </div>

    <!-- Notification items -->
    <a ng-repeat="n in data.notifications track by n.sys_id"
       href="?id=ticket_detail&sys_id={{n.docSysId}}"
       class="ahc-notif-item"
       ng-click="$root.ahcNotifOpen = false; $root.ahcOverlay = true; $root.currentPageId = ''">
      <div class="ahc-notif-item__icon"><i class="fa fa-comment-o"></i></div>
      <div class="ahc-notif-item__body">
        <div class="ahc-notif-item__case" ng-if="n.caseNum">{{n.caseNum}}</div>
        <div class="ahc-notif-item__msg">{{n.message}}</div>
        <div class="ahc-notif-item__meta">
          <span ng-if="n.fromName">{{n.fromName}} · </span>{{n.createdOn}}
        </div>
      </div>
      <i class="fa fa-chevron-right ahc-notif-item__arrow"></i>
    </a>
  </div>

  <div class="ahc-notif-panel__footer">
    <a href="?id=ticket_list" class="ahc-notif-panel__footer-link"
       ng-click="$root.ahcNotifOpen = false; $root.currentPageId !== 'ticket_list' && ($root.ahcOverlay = true)">
      View all my cases <i class="fa fa-arrow-right"></i>
    </a>
  </div>
</div>

<!-- Page transition overlay — visible during SPA navigation -->
<div class="ahc-nav__page-overlay" ng-show="$root.ahcOverlay">
  <i class="fa fa-spinner fa-spin ahc-nav__page-spinner-icon"></i>
  <p class="ahc-nav__page-spinner-label">Loading…</p>
</div>
`.trim();

const HEADER_CSS = `
/* Page transition overlay */
.ahc-nav__page-overlay {
  position: fixed;
  top: 56px;
  left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.82);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  z-index: 8000;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
  -ms-flex-direction: column;
  flex-direction: column;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  gap: 14px;
}
.ahc-nav__page-spinner-icon {
  font-size: 2em;
  color: #1a2980;
  opacity: 0.7;
}
.ahc-nav__page-spinner-label {
  font-size: 0.875em;
  color: #64748b;
  margin: 0;
}

/* Page loading bar */
@-webkit-keyframes ahc-bar-sweep {
  0%   { -webkit-transform: translateX(-100%); transform: translateX(-100%); }
  60%  { -webkit-transform: translateX(0%);    transform: translateX(0%); }
  100% { -webkit-transform: translateX(100%);  transform: translateX(100%); }
}
@keyframes ahc-bar-sweep {
  0%   { -webkit-transform: translateX(-100%); transform: translateX(-100%); }
  60%  { -webkit-transform: translateX(0%);    transform: translateX(0%); }
  100% { -webkit-transform: translateX(100%);  transform: translateX(100%); }
}
.ahc-nav__loading-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  overflow: hidden;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  -webkit-transition: opacity 0.3s ease 1s;
  transition: opacity 0.3s ease 1s;
}
.ahc-nav__loading-bar--on {
  opacity: 1;
  -webkit-transition: opacity 0s;
  transition: opacity 0s;
  background: rgba(255,255,255,0.15);
}
.ahc-nav__loading-bar--on::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 60%;
  background: #fff;
  -webkit-animation: ahc-bar-sweep 1.1s ease-in-out infinite;
  animation: ahc-bar-sweep 1.1s ease-in-out infinite;
}

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

/* ── Notification panel ──────────────────────────────────────────────── */
.ahc-notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 6999;
}
.ahc-notif-panel {
  position: fixed;
  top: 62px;
  right: 16px;
  width: 360px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08);
  z-index: 7000;
  overflow: hidden;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
  -ms-flex-direction: column;
  flex-direction: column;
  border: 1px solid #e8edf8;
}
.ahc-notif-panel__header {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: justify;
  -ms-flex-pack: justify;
  justify-content: space-between;
  padding: 16px 20px 14px;
  border-bottom: 1px solid #f1f5f9;
}
.ahc-notif-panel__title {
  font-size: 0.9em;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.1px;
}
.ahc-notif-panel__close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.9em;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  -webkit-transition: color 0.15s;
  transition: color 0.15s;
}
.ahc-notif-panel__close:hover { color: #475569; }
.ahc-notif-panel__list {
  overflow-y: auto;
  max-height: 400px;
}
.ahc-notif-panel__empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}
.ahc-notif-panel__empty p { margin: 8px 0 0; font-size: 0.875em; }
.ahc-notif-panel__empty-icon { font-size: 2em; display: block; }
.ahc-notif-item {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: flex-start;
  -ms-flex-align: flex-start;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #f8f9fc;
  text-decoration: none;
  -webkit-transition: background 0.12s;
  transition: background 0.12s;
  cursor: pointer;
}
.ahc-notif-item:hover { background: #f8faff; text-decoration: none; }
.ahc-notif-item__icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #e8edf8;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  color: #1a2980;
  font-size: 0.85em;
  -ms-flex-negative: 0;
  flex-shrink: 0;
}
.ahc-notif-item__body {
  -webkit-box-flex: 1;
  -ms-flex: 1;
  flex: 1;
  min-width: 0;
}
.ahc-notif-item__case {
  font-size: 0.75em;
  font-weight: 700;
  color: #1a2980;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 2px;
}
.ahc-notif-item__msg {
  font-size: 0.875em;
  color: #1e293b;
  line-height: 1.4;
  margin-bottom: 3px;
}
.ahc-notif-item__meta {
  font-size: 0.75em;
  color: #94a3b8;
}
.ahc-notif-item__arrow {
  color: #cbd5e1;
  font-size: 0.75em;
  margin-top: 4px;
  -ms-flex-negative: 0;
  flex-shrink: 0;
}
.ahc-notif-panel__footer {
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
  text-align: center;
}
.ahc-notif-panel__footer-link {
  font-size: 0.8em;
  font-weight: 600;
  color: #1a2980;
  text-decoration: none;
  letter-spacing: 0.2px;
}
.ahc-notif-panel__footer-link:hover { color: #141f6a; text-decoration: none; }
.ahc-notif-panel__footer-link i { margin-left: 5px; font-size: 0.85em; }

/* ── Portal-wide link + catalog color overrides (highest priority) ─────── */
/* Exclude navbar and footer links — :not() only accepts simple selectors */
body a:not(.ahc-nav__brand):not(.ahc-nav__link):not(.ahc-footer__link),
body a:visited:not(.ahc-nav__brand):not(.ahc-nav__link):not(.ahc-footer__link) {
  color: #1a2980 !important;
}
body a:hover:not(.ahc-nav__brand):not(.ahc-nav__link):not(.ahc-footer__link),
body a:focus:not(.ahc-nav__brand):not(.ahc-nav__link):not(.ahc-footer__link) {
  color: #141f6a !important;
}
.breadcrumb > li > a,
.breadcrumb > li > a:visited,
.breadcrumb > li > span > a {
  color: #1a2980 !important;
}
.breadcrumb > li > a:hover {
  color: #141f6a !important;
}
.label-danger {
  background-color: #1a2980 !important;
  border-color: #141f6a !important;
  color: #fff !important;
}
.text-active,
.text-primary {
  color: #1a2980 !important;
}
.panel-footer a,
.panel-footer a:visited {
  color: #1a2980 !important;
}
.panel-footer a:hover {
  color: #141f6a !important;
}
.catalog-item-name,
.catalog-item-name a {
  color: #1a2980 !important;
}
`.trim();

// ── Footer ────────────────────────────────────────────────────────────────────

const FOOTER_TEMPLATE = `
<style>
  /* ── Last-word overrides: render after all widget CSS ─────────────────────
     The footer renders after every widget on the page, so same-specificity
     !important rules here beat anything compiled into widget stylesheets.   */

  /* Catalog item form: sticky item header (the gray title area) */
  .sc-sticky-item-header {
    background-color: #fff !important;
    border-bottom: 1px solid #e8edf8 !important;
    border-radius: 0 !important;
  }
  .sc-sticky-item-header h2 {
    font-size: 22px !important; font-weight: 700 !important;
    color: #0f172a !important; letter-spacing: -0.2px !important;
  }
  .sc-cat-item-short-description {
    color: #64748b !important; font-size: 13px !important;
  }

  /* Required-info tags: actual widget class (NOT label-danger) */
  .sc-field-error-label,
  .sc-reqd-info-btn {
    background-color: #1a2980 !important; color: #fff !important;
    border-radius: 20px !important; border: none !important;
    padding: 4px 11px !important; font-size: 11px !important;
    font-weight: 500 !important; cursor: pointer !important;
    white-space: normal !important;
  }
  .sc-reqd-info-btn:hover { background-color: #141f6a !important; }

  /* Form inputs */
  .form-control {
    border: 1.5px solid #e2e8f0 !important; border-radius: 7px !important;
    background: #fff !important; color: #1e293b !important;
    box-shadow: none !important;
  }
  .form-control:focus {
    border-color: #1a2980 !important; box-shadow: 0 0 0 3px rgba(26,41,128,0.09) !important;
  }
  .form-group > label {
    font-size: 11px !important; font-weight: 600 !important; color: #64748b !important;
    text-transform: uppercase !important; letter-spacing: 0.5px !important;
  }

  /* Table in multi-row variable fields */
  table thead th {
    background: #f1f5f9 !important; color: #475569 !important;
    font-size: 11px !important; font-weight: 700 !important;
    text-transform: uppercase !important; letter-spacing: 0.5px !important;
    padding: 9px 12px !important; border: none !important;
    border-bottom: 2px solid #e2e8f0 !important;
  }
  table tbody td {
    padding: 8px 12px !important; border: none !important;
    border-bottom: 1px solid #f1f5f9 !important; font-size: 13px !important;
  }

  /* Submit + action buttons */
  .btn-danger, .btn-danger:focus {
    background-color: #1a2980 !important; border-color: #141f6a !important; color: #fff !important;
    border-radius: 8px !important; font-weight: 600 !important;
    box-shadow: 0 2px 8px rgba(26,41,128,0.22) !important;
  }
  .btn-danger:hover, .btn-danger:active {
    background-color: #141f6a !important; box-shadow: 0 4px 14px rgba(26,41,128,0.32) !important;
  }
  .btn-primary { background: #1a2980 !important; border-color: #141f6a !important; border-radius: 6px !important; }
  .btn-primary:hover { background: #141f6a !important; }
  .btn-default { border: 1.5px solid #e2e8f0 !important; background: #fff !important; color: #475569 !important; border-radius: 6px !important; }
  .btn-default:hover { background: #f1f5f9 !important; }

  /* Notification panel link items — keep explicit text colors intact */
  .ahc-notif-item,
  .ahc-notif-item:visited { color: #1e293b !important; }
  .ahc-notif-item:hover   { color: #1e293b !important; }
  .ahc-notif-item__case   { color: #1a2980 !important; }
  .ahc-notif-item__msg    { color: #1e293b !important; }
  .ahc-notif-item__meta   { color: #94a3b8 !important; }
  .ahc-notif-panel__footer-link,
  .ahc-notif-panel__footer-link:visited { color: #1a2980 !important; }

  /* Navy pill/button links — restore white text beaten by global a { color: navy } */
  .ahc-cl__new-btn,
  .ahc-cl__new-btn:visited { color: #fff !important; }
  .ahc-cl__new-btn:hover   { color: #fff !important; }
  .ahc-hero__cta-pill,
  .ahc-hero__cta-pill:visited { color: #1a2980 !important; }
  .ahc-hero__cta-pill:last-child,
  .ahc-hero__cta-pill:last-child:visited { color: #fff !important; }
</style>

<footer class="ahc-footer">
  <div class="container">
    <div class="ahc-footer__inner">
      <div class="ahc-footer__brand">
        <img class="ahc-footer__logo-img" src="/cb8f9beb8762c1104c76ed7e0ebb35cc.iix" alt="Aspira" />
      </div>
      <div class="ahc-footer__links">
        <a class="ahc-footer__link" href="/help?id=sc_category&catalog_id=-1">Submit a Ticket</a>
        <!-- KB hidden until ready: <a class="ahc-footer__link" href="/help?id=ahc_kb_search">Knowledge Base</a> -->
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
