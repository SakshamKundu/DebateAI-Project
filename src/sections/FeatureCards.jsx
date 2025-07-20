import { debateFeatures } from "../constants";

const FeatureCards = () => (
  <div className="w-full padding-x-lg">
    <div className="mx-auto grid-3-cols">
      {debateFeatures.map(({ imgPath, title, desc }) => (
        <div
          key={title}
          className="card-border rounded-xl p-8 flex flex-col gap-4 hover:bg-black-200 transition-all duration-300"
        >
          <div className="size-14 flex items-center justify-center rounded-full bg-white-50/10 p-3">
            <img src={imgPath} alt={title} className="filter brightness-0 invert"/>
          </div>
          <h3 className="text-white text-2xl font-semibold mt-2">{title}</h3>
          <p className="text-white-50 text-lg">{desc}</p>
          <button className="mt-auto text-brand-blue hover:underline self-start">
            Learn more 
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default FeatureCards;