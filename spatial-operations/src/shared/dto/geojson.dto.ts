import { IsEnum, IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { GeoJsonType } from '../enums/geojson-type.enum.js';
import { ApiProperty } from '@nestjs/swagger';


export class GeoJsonDto {
    @ApiProperty({
        description: 'The geometric type of the GeoJSON object',
        enum: GeoJsonType,
        example: GeoJsonType.Polygon,
    })
    @IsEnum(GeoJsonType, { message: 'Invalid or unsupported GeoJSON type' })
    @IsNotEmpty()
    type!: GeoJsonType;

    @ApiProperty({
        description: 'The coordinates of the geometry. Structure depends on the "type" field.',
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        example: [
            [
                [-3.7038, 40.4168],
                [-3.7038, 40.4200],
                [-3.7100, 40.4200],
                [-3.7100, 40.4168],
                [-3.7038, 40.4168], // Note: Polygons must close the loop!
            ],
        ],
    })
    @IsArray()
    @IsNotEmpty()
    coordinates!: any[];
}