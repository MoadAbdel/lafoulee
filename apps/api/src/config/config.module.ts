import { Global, Module } from "@nestjs/common";
import { ENV, env } from "./env.js";

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => env() }],
  exports: [ENV],
})
export class ConfigModule {}
