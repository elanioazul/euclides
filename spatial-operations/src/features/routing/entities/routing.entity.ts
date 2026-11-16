import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { LineString } from 'geojson';

// Schema comes from the DataSource (DATABASE_SCHEMA), so it is not hard-coded here
@Entity({ name: 'routes' })
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'LineString', srid: 4326 })
  geom: LineString;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
