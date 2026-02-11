/* eslint-disable no-console */
/**
 * Database Seed Script
 *
 * Creates sample data for development and testing.
 * Run with: `bun run db:seed`
 *
 * WARNING: This script is destructive — it clears existing data first.
 */
import { closeDatabase, db } from './connection';
import {
  dashboards,
  pages,
  users,
  widgets,
} from './schema/index';

/** Simple hash placeholder — in production, use bcrypt (see auth service) */
const DEMO_PASSWORD_HASH =
  '$2b$10$dummyhashfordevseeding000000000000000000000000000';

function seed() {
  console.log('🌱 Seeding database...');

  try {
    // ── Clear existing data (order matters due to FK constraints) ──
    db.delete(widgets).run();
    db.delete(pages).run();
    db.delete(dashboards).run();
    db.delete(users).run();

    // ── Create test user ────────────────────────────
    const testUser = db
      .insert(users)
      .values({
        email: 'demo@dashy.dev',
        passwordHash: DEMO_PASSWORD_HASH,
        displayName: 'Demo User',
      })
      .returning()
      .get();

    console.log(`  ✅ Created user: ${testUser.email} (${testUser.id})`);

    // ── Create sample dashboard ─────────────────────
    const sampleDashboard = db
      .insert(dashboards)
      .values({
        userId: testUser.id,
        name: 'My Homelab',
        slug: 'my-homelab',
        description: 'Main dashboard for monitoring homelab services',
        isDefault: true,
      })
      .returning()
      .get();

    console.log(
      `  ✅ Created dashboard: ${sampleDashboard.name} (${sampleDashboard.id})`,
    );

    // ── Create sample pages ─────────────────────────
    const overviewPage = db
      .insert(pages)
      .values({
        dashboardId: sampleDashboard.id,
        name: 'Overview',
        sortOrder: 0,
        layout: { columns: 12, rowHeight: 80, gap: 16 },
      })
      .returning()
      .get();

    const servicesPage = db
      .insert(pages)
      .values({
        dashboardId: sampleDashboard.id,
        name: 'Services',
        sortOrder: 1,
        layout: { columns: 12, rowHeight: 80, gap: 16 },
      })
      .returning()
      .get();

    console.log(
      `  ✅ Created pages: ${overviewPage.name}, ${servicesPage.name}`,
    );

    // ── Create sample widgets ───────────────────────
    const widgetData = [
      {
        pageId: overviewPage.id,
        type: 'weather',
        title: 'Local Weather',
        x: 0,
        y: 0,
        w: 4,
        h: 3,
        config: {
          location: 'San Francisco, CA',
          units: 'imperial',
        },
      },
      {
        pageId: overviewPage.id,
        type: 'health-check',
        title: 'Plex Server',
        x: 4,
        y: 0,
        w: 4,
        h: 2,
        config: {
          url: 'http://plex.local:32400/web',
          method: 'GET',
          interval: 30,
          timeout: 5000,
        },
      },
      {
        pageId: overviewPage.id,
        type: 'health-check',
        title: 'Home Assistant',
        x: 8,
        y: 0,
        w: 4,
        h: 2,
        config: {
          url: 'http://homeassistant.local:8123',
          method: 'GET',
          interval: 30,
          timeout: 5000,
        },
      },
      {
        pageId: overviewPage.id,
        type: 'rss',
        title: 'Hacker News',
        x: 0,
        y: 3,
        w: 6,
        h: 4,
        config: {
          feedUrl: 'https://hnrss.org/frontpage',
          maxItems: 10,
        },
      },
      {
        pageId: overviewPage.id,
        type: 'markdown',
        title: 'Quick Notes',
        x: 6,
        y: 3,
        w: 6,
        h: 4,
        config: {
          content:
            '## Welcome to Dashy! 🚀\n\nThis is your personal dashboard.\n\n- Customize widgets\n- Add new pages\n- Monitor your services',
        },
      },
      {
        pageId: servicesPage.id,
        type: 'app-launcher',
        title: 'My Apps',
        x: 0,
        y: 0,
        w: 12,
        h: 3,
        config: {
          items: [
            {
              name: 'Portainer',
              url: 'http://portainer.local:9000',
              icon: '🐳',
            },
            {
              name: 'Grafana',
              url: 'http://grafana.local:3000',
              icon: '📊',
            },
            {
              name: 'Pi-hole',
              url: 'http://pihole.local/admin',
              icon: '🛡️',
            },
            {
              name: 'Nextcloud',
              url: 'http://nextcloud.local',
              icon: '☁️',
            },
          ],
        },
      },
    ];

    db.insert(widgets).values(widgetData).run();

    console.log(`  ✅ Created ${widgetData.length} widgets`);

    // ── Create second dashboard ─────────────────────
    db.insert(dashboards)
      .values({
        userId: testUser.id,
        name: 'Development',
        slug: 'development',
        description: 'Dev tools and CI/CD monitoring',
      })
      .run();

    console.log('  ✅ Created secondary dashboard: Development');

    console.log('\n🎉 Seeding complete!');
    console.log('   Login: demo@dashy.dev');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

seed();
