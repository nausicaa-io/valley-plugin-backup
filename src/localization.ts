import type { ValleyPluginApi } from '@valley/plugin-sdk'
import { generatedCatalogs } from './generatedCatalogs'

const surfaceCatalogs = {
  "en": {
    "backup.surface.status": "Backup progress",
    "backup.surface.profiles": "List backup profiles",
    "backup.surface.profile-read": "Read backup profile",
    "backup.surface.profile-create": "Create backup profile",
    "backup.surface.profile-update": "Update backup profile",
    "backup.surface.profile-delete": "Delete backup profile",
    "backup.surface.check": "Check backup profile",
    "backup.surface.history": "Read backup history",
    "backup.surface.prune-preview": "Preview backup retention",
    "backup.surface.prune": "Apply backup retention",
    "backup.surface.restore-preview": "Preview backup restore",
    "backup.surface.restore": "Restore backup mapping",
    "backup.surface.id": "Profile ID",
    "backup.surface.name": "Name",
    "backup.surface.mappings": "Folder pairs",
    "backup.surface.trashPath": "Trash folder",
    "backup.surface.logDirectory": "Log folder",
    "backup.surface.masterLog": "Master log file",
    "backup.surface.profileCount": "Profiles",
    "backup.properties.saveError": "Could not save your changes. Your edits are kept; try again."
  },
  "de": {
    "backup.surface.status": "Sicherungsfortschritt",
    "backup.surface.profiles": "Sicherungsprofile auflisten",
    "backup.surface.profile-read": "Sicherungsprofil lesen",
    "backup.surface.profile-create": "Sicherungsprofil erstellen",
    "backup.surface.profile-update": "Sicherungsprofil bearbeiten",
    "backup.surface.profile-delete": "Sicherungsprofil löschen",
    "backup.surface.check": "Sicherungsprofil prüfen",
    "backup.surface.history": "Sicherungsverlauf lesen",
    "backup.surface.prune-preview": "Aufbewahrungsvorschau anzeigen",
    "backup.surface.prune": "Aufbewahrungsregeln anwenden",
    "backup.surface.restore-preview": "Wiederherstellungsvorschau anzeigen",
    "backup.surface.restore": "Sicherung wiederherstellen",
    "backup.surface.id": "Profil-ID",
    "backup.surface.name": "Name",
    "backup.surface.mappings": "Ordnerpaare",
    "backup.surface.trashPath": "Papierkorbordner",
    "backup.surface.logDirectory": "Protokollordner",
    "backup.surface.masterLog": "Hauptprotokolldatei",
    "backup.surface.profileCount": "Profile",
    "backup.properties.saveError": "Deine Änderungen konnten nicht gespeichert werden. Sie bleiben erhalten; versuche es erneut."
  },
  "es": {
    "backup.surface.status": "Progreso de copia",
    "backup.surface.profiles": "Listar perfiles de copia",
    "backup.surface.profile-read": "Leer perfil de copia",
    "backup.surface.profile-create": "Crear perfil de copia",
    "backup.surface.profile-update": "Editar perfil de copia",
    "backup.surface.profile-delete": "Eliminar perfil de copia",
    "backup.surface.check": "Comprobar perfil de copia",
    "backup.surface.history": "Leer historial de copias",
    "backup.surface.prune-preview": "Vista previa de retención",
    "backup.surface.prune": "Aplicar retención",
    "backup.surface.restore-preview": "Vista previa de restauración",
    "backup.surface.restore": "Restaurar copia",
    "backup.surface.id": "ID del perfil",
    "backup.surface.name": "Nombre",
    "backup.surface.mappings": "Pares de carpetas",
    "backup.surface.trashPath": "Carpeta de papelera",
    "backup.surface.logDirectory": "Carpeta de registros",
    "backup.surface.masterLog": "Archivo de registro principal",
    "backup.surface.profileCount": "Perfiles",
    "backup.properties.saveError": "No se pudieron guardar los cambios. Se conservan; inténtalo de nuevo."
  },
  "fr": {
    "backup.surface.status": "Progression de la sauvegarde",
    "backup.surface.profiles": "Lister les profils de sauvegarde",
    "backup.surface.profile-read": "Lire le profil de sauvegarde",
    "backup.surface.profile-create": "Créer un profil de sauvegarde",
    "backup.surface.profile-update": "Modifier le profil de sauvegarde",
    "backup.surface.profile-delete": "Supprimer le profil de sauvegarde",
    "backup.surface.check": "Vérifier le profil de sauvegarde",
    "backup.surface.history": "Lire l’historique des sauvegardes",
    "backup.surface.prune-preview": "Aperçu de la rétention",
    "backup.surface.prune": "Appliquer la rétention",
    "backup.surface.restore-preview": "Aperçu de la restauration",
    "backup.surface.restore": "Restaurer la sauvegarde",
    "backup.surface.id": "Identifiant du profil",
    "backup.surface.name": "Nom",
    "backup.surface.mappings": "Paires de dossiers",
    "backup.surface.trashPath": "Dossier de corbeille",
    "backup.surface.logDirectory": "Dossier des journaux",
    "backup.surface.masterLog": "Fichier journal principal",
    "backup.surface.profileCount": "Profils",
    "backup.properties.saveError": "Impossible d’enregistrer vos modifications. Elles sont conservées ; réessayez."
  },
  "zh-CN": {
    "backup.surface.status": "备份进度",
    "backup.surface.profiles": "列出备份配置",
    "backup.surface.profile-read": "读取备份配置",
    "backup.surface.profile-create": "创建备份配置",
    "backup.surface.profile-update": "编辑备份配置",
    "backup.surface.profile-delete": "删除备份配置",
    "backup.surface.check": "检查备份配置",
    "backup.surface.history": "读取备份历史",
    "backup.surface.prune-preview": "预览备份保留清理",
    "backup.surface.prune": "执行备份保留清理",
    "backup.surface.restore-preview": "预览恢复",
    "backup.surface.restore": "恢复备份",
    "backup.surface.id": "配置 ID",
    "backup.surface.name": "名称",
    "backup.surface.mappings": "文件夹配对",
    "backup.surface.trashPath": "回收站文件夹",
    "backup.surface.logDirectory": "日志文件夹",
    "backup.surface.masterLog": "主日志文件",
    "backup.surface.profileCount": "配置数",
    "backup.properties.saveError": "无法保存更改。编辑内容已保留；请重试。"
  }
}

function english(key: string, params?: Parameters<ValleyPluginApi['ui']['t']>[1]): string {
  const fallback = (surfaceCatalogs.en as Record<string, string>)[key] ?? (generatedCatalogs.en as Record<string, string>)[key] ?? key
  return fallback.replace(/\{\{([^}]+)\}\}/g, (_match: string, name: string) => String(params?.[name] ?? ''))
}

let translate: ValleyPluginApi['ui']['t'] = english

export function initLocalization(api: ValleyPluginApi): void {
  translate = (key, params) => {
    const value = api.ui.t(key, params)
    return value === key ? english(key, params) : value
  }
  api.ui.registerCatalogs(generatedCatalogs)
  api.ui.registerCatalogs(surfaceCatalogs)
}

export function uiText(key: string, params?: Parameters<ValleyPluginApi['ui']['t']>[1]): string {
  return translate(key, params)
}
