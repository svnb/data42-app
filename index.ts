import * as pulumi from "@pulumi/pulumi"
import { SnowflakeCore } from "./src/snowflake-core"
import { AppArgs } from "./src/types"
import { OutputPort } from "./src/output-ports"
import { Datahub } from "./src/datahub"

const config = new pulumi.Config()
const data = config.requireObject<AppArgs>("data")

const snowflake = new SnowflakeCore(
    "snowflake", { ...data, ...data.snowflake }
)

const outputPorts = data.outputPorts.map(port => new OutputPort(port.name, { app: data.name, name: port.name, snowflake }))

if (data.datahub) {
    new Datahub("datahub", {
        app: data.name,
        snowflake,
        outputPorts
    })
}