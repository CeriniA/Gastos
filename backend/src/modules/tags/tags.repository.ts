import type { Tag } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { TagModel, type TagDoc } from './tags.model';

function toTag(doc: TagDoc): Tag {
  return {
    id: doc._id.toString(),
    name: doc.name,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const tagsPort = createCollectionPort(TagModel);

export const tagsRepository = {
  async findAll(options: WriteOptions = {}): Promise<Tag[]> {
    const docs = await TagModel.find()
      .sort({ nameKey: 1 })
      .session(options.session ?? null)
      .lean<TagDoc[]>();
    return docs.map(toTag);
  },

  async findById(id: string): Promise<Tag | null> {
    const doc = await TagModel.findById(toObjectId(id)).lean<TagDoc>();
    return doc ? toTag(doc) : null;
  },

  async findByNameKey(nameKey: string): Promise<Tag | null> {
    const doc = await TagModel.findOne({ nameKey }).lean<TagDoc>();
    return doc ? toTag(doc) : null;
  },

  async create(data: { name: string; nameKey: string }, options: WriteOptions = {}): Promise<Tag> {
    const [doc] = await TagModel.create([data], { session: options.session });
    return toTag(doc!.toObject() as TagDoc);
  },

  async rename(id: string, data: { name: string; nameKey: string }): Promise<Tag | null> {
    const doc = await TagModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: data },
      { new: true },
    ).lean<TagDoc>();
    return doc ? toTag(doc) : null;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await TagModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },
};

export type TagsRepository = typeof tagsRepository;
