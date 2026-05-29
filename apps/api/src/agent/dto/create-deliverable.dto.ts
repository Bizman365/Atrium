import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class CreateAgentDeliverableDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ValidateIf((o: CreateAgentDeliverableDto) => !o.fileId)
  @IsString()
  @IsOptional()
  url?: string;

  @ValidateIf((o: CreateAgentDeliverableDto) => !o.url)
  @IsString()
  @IsOptional()
  fileId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  externalId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  source?: string;

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;
}
