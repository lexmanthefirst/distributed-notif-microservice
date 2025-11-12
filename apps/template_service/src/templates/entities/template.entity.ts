import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("templates")
export class Template {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true, length: 100 })
  @Index()
  code!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 500 })
  subject!: string;

  @Column("text")
  html_body!: string;

  @Column("text")
  text_body!: string;

  @Column("text", { array: true, default: () => "'{}'" })
  variables!: string[];

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: "text", nullable: true })
  description?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
