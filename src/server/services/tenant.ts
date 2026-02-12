/**
 * Tenant Context Service
 *
 * Provides tenant isolation and context for multi-tenant operations.
 * This is preparation for future SaaS multi-tenant expansion.
 *
 * Current state: User-level isolation (each user has their own data).
 * Future: Organization-level isolation with team workspaces.
 */
import { eq, and } from 'drizzle-orm'
import { db } from '@server/db/connection'
import { tenants, tenantMemberships } from '@server/db/schema/tenants'
import { dashboards } from '@server/db/schema/dashboards'
import type {
  Tenant,
  TenantMembership,
  TenantRole,
} from '@server/db/schema/tenants'

export interface TenantContext {
  tenantId: string | null
  userId: string
  role: TenantRole | null
  isMultiTenant: boolean
}

export interface TenantLimits {
  maxUsers: number
  maxDashboards: number
  currentUsers: number
  currentDashboards: number
}

class TenantService {
  async getTenantForUser(userId: string): Promise<TenantMembership | null> {
    const [membership] = await db
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, userId))
      .limit(1)

    return membership ?? null
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)

    return tenant ?? null
  }

  async getTenantContext(userId: string): Promise<TenantContext> {
    const membership = await this.getTenantForUser(userId)

    return {
      tenantId: membership?.tenantId ?? null,
      userId,
      role: (membership?.role as TenantRole) ?? null,
      isMultiTenant: membership !== null,
    }
  }

  async getTenantLimits(tenantId: string): Promise<TenantLimits | null> {
    const tenant = await this.getTenant(tenantId)
    if (!tenant) return null

    const userCount = await db
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.tenantId, tenantId))

    const dashboardCount = await db.select().from(dashboards)

    return {
      maxUsers: tenant.maxUsers,
      maxDashboards: tenant.maxDashboards,
      currentUsers: userCount.length,
      currentDashboards: dashboardCount.length,
    }
  }

  async canCreateDashboard(userId: string): Promise<boolean> {
    const context = await this.getTenantContext(userId)

    if (!context.isMultiTenant) {
      return true
    }

    const limits = await this.getTenantLimits(context.tenantId!)
    if (!limits) return true

    return limits.currentDashboards < limits.maxDashboards
  }

  async canInviteUser(userId: string): Promise<boolean> {
    const context = await this.getTenantContext(userId)

    if (!context.isMultiTenant) {
      return false
    }

    if (context.role !== 'owner') {
      return false
    }

    const limits = await this.getTenantLimits(context.tenantId!)
    if (!limits) return false

    return limits.currentUsers < limits.maxUsers
  }

  async createUserTenant(userId: string, name: string): Promise<Tenant> {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const [tenant] = await db
      .insert(tenants)
      .values({
        name,
        slug,
        plan: 'free',
      })
      .returning()

    await db.insert(tenantMemberships).values({
      tenantId: tenant.id,
      userId,
      role: 'owner',
    })

    return tenant
  }

  async addUserToTenant(
    tenantId: string,
    userId: string,
    role: TenantRole = 'member',
    invitedBy?: string,
  ): Promise<TenantMembership> {
    const [membership] = await db
      .insert(tenantMemberships)
      .values({
        tenantId,
        userId,
        role,
        invitedBy,
      })
      .returning()

    return membership
  }

  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    await db
      .delete(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, userId),
        ),
      )
  }

  hasRole(context: TenantContext, requiredRole: TenantRole): boolean {
    if (!context.isMultiTenant) {
      return true
    }

    const roleHierarchy: Record<TenantRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    }

    const userLevel = roleHierarchy[context.role as TenantRole] ?? 0
    const requiredLevel = roleHierarchy[requiredRole]

    return userLevel >= requiredLevel
  }
}

export const tenantService = new TenantService()
