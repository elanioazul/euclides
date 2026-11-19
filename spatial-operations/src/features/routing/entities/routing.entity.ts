import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { LineString } from 'geojson';
import { RouteType } from '../enums/route-type.enum.js';
import type { StoredSegment } from '../interfaces/stored-segment.interface.js';

// The schema is always explicit: the DataSource has no default schema.
// No `database` option: the Postgres driver ignores it, the DataSource already targets spatialdb.
@Entity({ schema: 'routing', name: 'routes' })
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Derived from the segment modes, never sent by the client
  @Column({ type: 'varchar', length: 16 })
  type: RouteType;

  // Original input, kept so the route can be re-processed or re-edited later
  @Column({ type: 'jsonb' })
  segments: StoredSegment[];

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 4326 })
  geom: LineString;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
