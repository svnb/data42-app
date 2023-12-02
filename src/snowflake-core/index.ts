import * as pulumi from "@pulumi/pulumi"
import * as snowflake from "@pulumi/snowflake"
import * as random from "@pulumi/random"

import { SnowflakeCoreArgs } from "./types"

export class SnowflakeCore extends pulumi.ComponentResource {

    database: snowflake.Database
    role: snowflake.Role
    warehouses: {
        isDefault: boolean,
        snowflakeObject: snowflake.Warehouse
    }[]
    user: snowflake.User

    constructor(name: string, args: SnowflakeCoreArgs, opts?: pulumi.ComponentResourceOptions) {
        super("pkg:index:SnowflakeCore", name, opts)

        this.database = new snowflake.Database("database", {
            name: args.name.toUpperCase()
        }, { parent: this })

        this.role = new snowflake.Role("role", {
            name: `${args.name}`.toUpperCase()
        }, { parent: this })

        this.warehouses = args.warehouses.map(warehouse => {
            const wh = new snowflake.Warehouse(
                warehouse.name, {
                ...warehouse,
                name: `${args.name}_${warehouse.name}`.toUpperCase()
            }, { parent: this })

            new snowflake.GrantPrivilegesToRole(`role->${warehouse.name}`, {
                roleName: this.role.name,
                privileges: ['APPLYBUDGET', 'MONITOR', 'MODIFY', 'OPERATE', 'USAGE'],
                onAccountObject: {
                    objectName: wh.name,
                    objectType: "WAREHOUSE"
                }
            }, { parent: this })

            return {
                isDefault: warehouse.default || false,
                snowflakeObject: wh,
            }
        }, { parent: this })

        const password = new random.RandomPassword("user-password", {
            length: 16
        }, { parent: this })

        this.user = new snowflake.User("user", {
            name: args.name.toUpperCase(),
            displayName: args.name.toUpperCase(),
            defaultWarehouse: this.warehouses.find(wh => wh.isDefault)!!.snowflakeObject.name,
            defaultRole: this.role.name,
            password: password.result
        }, { parent: this })

        const deploymentRoleGrant = new snowflake.RoleGrants('role->deployment', {
            roleName: this.role.name,
            roles: ['DEPLOYMENT'],
            users: [this.user.name]
        }, { parent: this })

        new snowflake.GrantPrivilegesToRole('role->public-schema-usage', {
            roleName: this.role.name,
            privileges: ["USAGE"],
            onSchema: {
                schemaName: pulumi.interpolate`"${this.database.name}"."PUBLIC"`
            }
        }, { parent: this })

        // new snowflake.GrantPrivilegesToRole('role->public-schema-ownership', {
        //     roleName: this.role.name,
        //     privileges: ["OWNERSHIP"],
        //     onSchema: {
        //         schemaName: pulumi.interpolate`"${this.database.name}"."PUBLIC"`
        //     }
        // }, { parent: this })
        // Use below resource for now due to bug with destroy.

        new snowflake.SchemaGrant('role->public-schema-ownership', {
            roles: [this.role.name],
            privilege: "OWNERSHIP",
            schemaName: "PUBLIC",
            databaseName: this.database.name
        }, { parent: this })

        new snowflake.DatabaseGrant('role->db-ownership', {
            roles: [this.role.name],
            privilege: "OWNERSHIP",
            databaseName: this.database.name
        }, { dependsOn: deploymentRoleGrant, parent: this })

        this.registerOutputs({
            database: this.database,
            role: this.role,
            warehouses: this.warehouses,
            user: this.user
        })
    }
}