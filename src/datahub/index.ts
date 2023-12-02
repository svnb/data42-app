import * as snowflake from "@pulumi/snowflake"
import * as pulumi from "@pulumi/pulumi"
import { SnowflakeCore } from "../snowflake-core"
import { OutputPort } from "../output-ports"

const DATAHUB = 'DATAHUB'

interface DatahubArgs {
    app: string,
    snowflake: SnowflakeCore,
    outputPorts: OutputPort[]
}

export class Datahub extends pulumi.ComponentResource {
    constructor(name: string, args: DatahubArgs, opts?: pulumi.ComponentResourceOptions) {
        super("pkg:index:Datahub", name, opts)
        new snowflake.GrantPrivilegesToRole('datahub>-db-usage', {
            roleName: DATAHUB,
            privileges: ["USAGE"],
            onAccountObject: {
                objectName: args.snowflake.database.name,
                objectType: 'DATABASE'
            }
        }, { parent: this })

        new snowflake.GrantPrivilegesToRole('datahub->public-schema-usage', {
            roleName: DATAHUB,
            privileges: ["USAGE"],
            onSchema: {
                schemaName: pulumi.interpolate`"${args.snowflake.database.name}"."PUBLIC"`

            }
        }, { parent: this })


        args.outputPorts.forEach(port => {
            new snowflake.GrantPrivilegesToRole(`datahub->${port.output}-usage`, {
                roleName: DATAHUB,
                privileges: ["USAGE"],
                onSchema: {
                    schemaName: pulumi.interpolate`"${args.snowflake.database.name}"."${port.schema.name}"`
                }
            }), { parent: this }
        })

        new snowflake.GrantPrivilegesToRole("datahub->future-schema-usage", {
            roleName: DATAHUB,
            privileges: ["USAGE"],
            onSchema: {
                futureSchemasInDatabase: args.snowflake.database.name
            }
        }, { parent: this })


        const referencesObjects = ["TABLES", "VIEWS", "EXTERNAL TABLES"]
        referencesObjects.forEach(object => {
            new snowflake.GrantPrivilegesToRole(`datahub->reference-future-${object}`,
                {
                    roleName: DATAHUB,
                    privileges: ["REFERENCES"],
                    onSchemaObject: {
                        future: {
                            objectTypePlural: object,
                            inDatabase: args.snowflake.database.name
                        }
                    }
                }, { parent: this }
            )
        })
    }
}