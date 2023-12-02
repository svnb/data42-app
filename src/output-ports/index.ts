import * as pulumi from "@pulumi/pulumi";
import * as snowflake from "@pulumi/snowflake";
import { OutputPortArgs } from "./types";

export class OutputPort extends pulumi.ComponentResource {
  output: string;
  schema: snowflake.Schema;
  role: snowflake.Role;

  constructor(
    name: string,
    args: OutputPortArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("pkg:index:OutputPort", name, opts);

    this.output = args.name;

    this.schema = new snowflake.Schema(
      args.name,
      {
        name: args.name.toUpperCase(),
        database: args.snowflake.database.name,
        isManaged: true,
      },
      { parent: this },
    );

    // Dedicated Role for this schema. Allow select on desired output objects.
    this.role = new snowflake.Role(
      `${args.name}`,
      {
        name: `${args.app}_${args.name}`.toUpperCase(),
      },
      { parent: this },
    );

    new snowflake.RoleGrants(
      `${args.name}->role`,
      {
        roleName: this.role.name,
        roles: [args.snowflake.role.name],
      },
      { parent: this },
    );

    new snowflake.GrantPrivilegesToRole(
      `${args.name}-database-usage`,
      {
        privileges: ["USAGE"],
        roleName: this.role.name,
        onAccountObject: {
          objectType: "DATABASE",
          objectName: args.snowflake.database.name,
        },
      },
      { parent: this },
    );

    new snowflake.GrantPrivilegesToRole(
      `${args.name}-schema-usage`,
      {
        privileges: ["USAGE"],
        roleName: this.role.name,
        onSchema: {
          schemaName: pulumi
            .all([args.snowflake.database.name, this.schema.name])
            .apply(([database, schema]) => `${database}.${schema}`),
        },
      },
      { parent: this },
    );

    const outputObjects = ["table", "view"]; // single entity for create permissions (e.g. create table)

    outputObjects.forEach((object) => {
      const onSchemaObject = {
        future: {
          objectTypePlural: `${object}S`.toUpperCase(), // add 'S' for plural.
          inSchema: pulumi.interpolate`"${args.snowflake.database.name}"."${this.schema.name}"`, // this needs to be quoted. Just how the snowflake provider works.
        },
      };

      // read only grants for output role
      new snowflake.GrantPrivilegesToRole(
        `${args.name}-${object}->select`,
        {
          privileges: ["SELECT"],
          roleName: this.role.name,
          onSchemaObject,
        },
        { parent: this },
      );

      // create and ownership for the app role
      new snowflake.GrantPrivilegesToRole(
        `role->${args.name}-${object}->create`,
        {
          privileges: [`CREATE ${object.toUpperCase()}`],
          roleName: this.role.name,
          onSchema: {
            schemaName: pulumi.interpolate`"${args.snowflake.database.name}"."${this.schema.name}"`,
          },
        },
        { parent: this },
      );

      new snowflake.GrantPrivilegesToRole(
        `role->${args.name}-${object}->ownership`,
        {
          privileges: ["OWNERSHIP"],
          roleName: this.role.name,
          onSchemaObject,
        },
        { parent: this, dependsOn: args.snowflake },
      ); // Wait until Role Hierarchy (role -> deployment from snowflake module) is created
    });

    this.registerOutputs({
      output: this.output,
      snowflake: {
        schema: this.schema,
        role: this.role,
      },
    });
  }
}
