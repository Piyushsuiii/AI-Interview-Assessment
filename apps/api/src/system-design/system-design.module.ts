import { Module } from "@nestjs/common";
import { SystemDesignController } from "./system-design.controller";
import { SystemDesignService } from "./system-design.service";

@Module({ controllers: [SystemDesignController], providers: [SystemDesignService] })
export class SystemDesignModule {}
