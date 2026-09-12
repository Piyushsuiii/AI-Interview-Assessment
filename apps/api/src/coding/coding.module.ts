import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CodingController } from "./coding.controller";
import { CODE_EXECUTION_QUEUE, createCodeExecutionQueue } from "./coding.queue";
import { CodingService } from "./coding.service";

@Module({
  controllers: [CodingController],
  providers: [CodingService, { provide: CODE_EXECUTION_QUEUE, inject: [ConfigService], useFactory: createCodeExecutionQueue }],
})
export class CodingModule {}
