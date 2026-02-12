#!/usr/bin/env bun
/**
 * Database Backup Script
 *
 * Creates full database backups with metadata.
 * Run: bun run scripts/backup.ts [--restore <backup-file>]
 */
import * as path from 'node:path'
import * as fs from 'node:fs'
import { config } from '@server/config'
import { backupService } from '@server/services/backup'

const BACKUP_DIR = path.join(path.dirname(config.database.path), 'backups')

function printUsage(): void {
  console.log(`
Dashy Database Backup Tool

Usage:
  bun run scripts/backup.ts [command] [options]

Commands:
  create    Create a new backup (default)
  list      List all available backups
  restore   Restore from a backup file

Options:
  --restore <file>   Restore from specified backup file
  --output <dir>     Custom backup directory (default: ./data/backups)
  --help             Show this help message

Examples:
  bun run scripts/backup.ts
  bun run scripts/backup.ts create
  bun run scripts/backup.ts list
  bun run scripts/backup.ts restore ./data/backups/dashy-backup-2026-02-13.db
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const command = args[0] ?? 'create'

  switch (command) {
    case 'create': {
      console.log('Creating database backup...')
      const outputDir = args[args.indexOf('--output') + 1] ?? BACKUP_DIR
      const metadata = backupService.createFullDatabaseBackup(outputDir)
      console.log('Backup created successfully!')
      console.log(`  File: ${metadata.databasePath}`)
      console.log(
        `  Tables: ${Object.entries(metadata.tables)
          .map(([k, v]) => `${k}(${v})`)
          .join(', ')}`,
      )
      console.log(`  Created: ${metadata.exportedAt}`)
      break
    }

    case 'list': {
      const backups = backupService.listBackups()
      if (backups.length === 0) {
        console.log('No backups found.')
        break
      }
      console.log(`Found ${backups.length} backup(s):\n`)
      for (const backup of backups) {
        console.log(`  ${backup.file}`)
        console.log(`    Created: ${backup.exportedAt}`)
        console.log(
          `    Tables: ${Object.entries(backup.tables)
            .map(([k, v]) => `${k}(${v})`)
            .join(', ')}`,
        )
        console.log()
      }
      break
    }

    case 'restore': {
      const backupFile = args[1]
      if (!backupFile) {
        console.error('Error: No backup file specified.')
        console.error('Usage: bun run scripts/backup.ts restore <backup-file>')
        process.exit(1)
      }
      if (!fs.existsSync(backupFile)) {
        console.error(`Error: Backup file not found: ${backupFile}`)
        process.exit(1)
      }
      console.log(`Restoring from: ${backupFile}`)
      console.log('WARNING: This will overwrite the current database!')
      console.log('Press Ctrl+C to cancel, or wait 3 seconds...')
      await new Promise((resolve) => setTimeout(resolve, 3000))
      backupService.restoreDatabaseFromBackup(backupFile)
      console.log('Database restored successfully!')
      console.log('Restart the application to use the restored database.')
      break
    }

    default:
      console.error(`Unknown command: ${command}`)
      printUsage()
      process.exit(1)
  }
}

main().catch((error) => {
  console.error('Backup failed:', error)
  process.exit(1)
})
