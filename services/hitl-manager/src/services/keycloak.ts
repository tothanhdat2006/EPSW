import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';
import { AssignedRole } from '@dvc/shared-types';

const JWKS = createRemoteJWKSet(
  new URL(`${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`),
);

export interface KeycloakUser {
  sub: string;
  preferred_username?: string;
  email?: string;
  roles: string[];
}

export async function verifyToken(token: string): Promise<KeycloakUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${config.keycloak.url}/realms/${config.keycloak.realm}`,
  });

  const realmRoles: string[] =
    (payload as JWTPayload & { realm_access?: { roles: string[] } }).realm_access?.roles ?? [];

  return {
    sub: payload.sub ?? '',
    preferred_username: (payload as { preferred_username?: string }).preferred_username,
    email: (payload as { email?: string }).email,
    roles: realmRoles,
  };
}

/**
 * ABAC check: verify the user holds the required role to act on a HITL task.
 */
export function canActOnTask(userRoles: string[], requiredRole: string): boolean {
  // LANH_DAO and QUAN_LY can act on any task
  if (userRoles.includes(AssignedRole.LANH_DAO) || userRoles.includes(AssignedRole.QUAN_LY)) {
    return true;
  }
  return userRoles.includes(requiredRole);
}

/**
 * Get the Keycloak Admin API access token for service-to-service calls.
 */
export async function getAdminToken(): Promise<string> {
  const tokenUrl = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.keycloak.clientId,
    client_secret: config.keycloak.clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
