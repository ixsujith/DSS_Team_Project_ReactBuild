const BASE_URL = "http://localhost:8080/api";

export async function testConnection(data) {
  const response = await fetch(`${BASE_URL}/db-config/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function saveDbConfig(data) {
  const response = await fetch(`${BASE_URL}/db-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getAllDbConfigs() {
  const response = await fetch(`${BASE_URL}/db-config`);
  return response.json();
}

export async function getAllDbTypes() {
  const response = await fetch(`${BASE_URL}/db-config/types`);
  return response.json();
}

export async function deleteDbConfig(id) {
  return fetch(`${BASE_URL}/db-config/${id}`, {
    method: "DELETE",
  });
}

export async function getConfigsByDbType(dbType) {
  const response = await fetch(
    `${BASE_URL}/db-config/by-type?dbType=${encodeURIComponent(dbType)}`,
  );
  return response.json();
}

export async function saveQuery(data) {
  const response = await fetch(`${BASE_URL}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getAllQueries() {
  const response = await fetch(`${BASE_URL}/queries`);
  return response.json();
}

export async function getQueriesByDbType(dbType) {
  const response = await fetch(
    `${BASE_URL}/queries/by-type?dbType=${encodeURIComponent(dbType)}`,
  );
  return response.json();
}

export async function deleteQuery(id) {
  return fetch(`${BASE_URL}/queries/${id}`, {
    method: "DELETE",
  });
}

export async function executeQuery(data) {
  const response = await fetch(`${BASE_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function executeTempQuery(data) {
  const response = await fetch(`${BASE_URL}/execute/temp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getAllAuditLogs() {
  const response = await fetch(`${BASE_URL}/audit-logs`);
  return response.json();
}

export async function getAuditLogsByDbType(dbType) {
  const response = await fetch(
    `${BASE_URL}/audit-logs/by-type?dbType=${encodeURIComponent(dbType)}`,
  );
  return response.json();
}

export async function getSchemaTables(configId) {
  const response = await fetch(`${BASE_URL}/schema/tables?configId=${configId}`);
  return response.json();
}

export async function getSchemaColumns(configId, tableName) {
  const response = await fetch(
    `${BASE_URL}/schema/columns?configId=${configId}&table=${encodeURIComponent(tableName)}`,
  );
  return response.json();
}
